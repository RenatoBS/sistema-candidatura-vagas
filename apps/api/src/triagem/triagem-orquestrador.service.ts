import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import {
  consentimentosVigentes,
  decidirBorda,
  atrasoReenvioConviteMs,
  dentroDaJanelaAgregacao,
  inatividadeDaPolitica,
  lerContexto,
  mensagemFluxoTriagem,
  mensagemTriagem,
  momentoLembreteInatividade,
  politicaTriagemEfetiva,
  triagemTerminal,
  type ContextoEntrevista,
  type MensagemBorda,
} from '@scv/domain';

import type { Relogio } from '../auth/auth.service';
import { CandidaturaStateMachine } from '../candidaturas/candidatura-state-machine';
import { ErroAplicacao } from '../erros';
import { FILA_TRIAGEM_RETRY, type FilaTriagem } from '../fila/fila-triagem';
import type { EntrevistaRegistro, StatusEntrevista } from '../repositorio/entrevistas-tipos';
import type { PerfilCandidato, Repositorio, RespostaSensivel } from '../repositorio/tipos';
import { FILA_TRIAGEM, RELOGIO, REPOSITORIO, TRAVA_ENTREVISTA } from '../tokens';
import { EnviadorWhatsapp, type ResultadoEnvio } from './enviador-whatsapp';
import { AvaliacaoTriagemService } from './triagem-avaliacao.service';
import { TriagemRetryService } from './triagem-retry.service';

const SISTEMA = { sistema: true as const };
const FILA_STT = 'stt-transcricao';

function suspensa(status: string): boolean {
  return status === 'SUSPENSA_PAUSA' || status === 'SUSPENSA_INSTANCIA';
}

export interface TravaEntrevista {
  executar<T>(chave: string, fn: () => Promise<T>): Promise<T>;
}

export class TravaEntrevistaMemoria implements TravaEntrevista {
  private readonly cadeias = new Map<string, Promise<unknown>>();

  async executar<T>(chave: string, fn: () => Promise<T>): Promise<T> {
    const anterior = this.cadeias.get(chave) ?? Promise.resolve();
    let liberar: () => void = () => undefined;
    const atual = new Promise<void>((resolve) => {
      liberar = resolve;
    });
    const cadeia = anterior.then(() => atual);
    this.cadeias.set(chave, cadeia);
    await anterior.catch(() => undefined);
    try {
      return await fn();
    } finally {
      liberar();
    }
  }
}

interface MensagemEvento extends MensagemBorda {
  mensagemIdProvedor?: string;
  numeroRemetente?: string;
}

@Injectable()
export class TriagemOrquestradorService {
  constructor(
    @Inject(REPOSITORIO) private readonly repo: Repositorio,
    @Inject(RELOGIO) private readonly relogio: Relogio,
    @Inject(EnviadorWhatsapp) private readonly enviador: EnviadorWhatsapp,
    @Inject(TriagemRetryService) private readonly retries: TriagemRetryService,
    @Inject(AvaliacaoTriagemService) private readonly avaliacao: AvaliacaoTriagemService,
    @Inject(CandidaturaStateMachine) private readonly candidaturas: CandidaturaStateMachine,
    @Inject(FILA_TRIAGEM) private readonly fila: FilaTriagem,
    @Inject(TRAVA_ENTREVISTA) private readonly trava: TravaEntrevista,
  ) {}

  async iniciar(candidaturaId: string): Promise<Record<string, unknown>> {
    const candidatura = await this.repo.buscarCandidatura(candidaturaId, SISTEMA);
    if (!candidatura) throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'candidatura não encontrada');
    const etapa = await this.etapaTriagem(candidatura.vagaId);
    const existente = await this.repo.buscarEntrevistaPorCandidaturaEtapa(candidatura.id, etapa.id, SISTEMA);
    if (existente?.iniciadaEm) {
      throw new ErroAplicacao('TENTATIVA_CONSUMIDA', 409, 'tentativa já consumida');
    }
    if (existente && !triagemTerminal(existente.status)) {
      return { iniciada: true, entrevistaId: existente.id, motivo: 'ja_existente' };
    }
    const instancia = await this.repo.buscarInstanciaPorEmpresa(candidatura.empresaId, SISTEMA);
    if (!instancia || instancia.status !== 'CONECTADA') {
      await this.alertar(candidatura.empresaId, candidatura.id, 'TRIAGEM_SEM_INSTANCIA');
      return { iniciada: false, motivo: 'INSTANCIA_INDISPONIVEL' };
    }
    const perfil = await this.perfil(candidatura.candidatoId);
    if (!perfil?.whatsapp) return { iniciada: false, motivo: 'NUMERO_AUSENTE' };
    if (!(await this.temOptIn(perfil.id))) return { iniciada: false, motivo: 'SEM_OPT_IN' };
    const agora = this.relogio.agora();
    const ocupada = await this.conversaOcupada(perfil.id, candidatura.empresaId);
    const entrevista = await this.repo.criarEntrevista(
      {
        id: randomUUID(),
        empresaId: candidatura.empresaId,
        candidaturaId: candidatura.id,
        etapaId: etapa.id,
        canal: 'WHATSAPP',
        status: ocupada ? 'AGENDADA' : 'AGUARDANDO_INICIO',
        retryAtual: 0,
        perguntaAtual: 0,
        iniciadaEm: null,
        ultimaInteracaoEm: null,
        proximoRetryEm: null,
        aceiteTentativaEm: null,
        excecaoConcedida: false,
        encerrarAoFim: false,
        contexto: {
          aguardandoConfirmacaoNumero: !ocupada && !perfil.whatsappVerificado,
          conviteEm: agora.toISOString(),
        },
        criadoEm: agora,
        atualizadoEm: agora,
      },
      SISTEMA,
    );
    if (ocupada) return { iniciada: false, motivo: 'FILA_DA_EMPRESA', entrevistaId: entrevista.id };
    if (!perfil.whatsappVerificado) {
      const envio = await this.tentarEnviar(entrevista, perfil, 'confirmacao_numero');
      if (!envio.ok && envio.transitoria) {
        const reenvioEm = await this.agendarReenvio(entrevista, perfil, 'confirmacao_numero', 1);
        return { iniciada: false, motivo: 'ENVIO_FALHOU', entrevistaId: entrevista.id, reenvioEm };
      }
      return { iniciada: true, confirmacao: true, entrevistaId: entrevista.id };
    }
    const convite = await this.abrirConvite(entrevista, perfil);
    if (!convite.ok) {
      return { iniciada: false, motivo: 'ENVIO_FALHOU', entrevistaId: entrevista.id, reenvioEm: convite.reenvioEm };
    }
    return { iniciada: true, entrevistaId: entrevista.id };
  }

  /**
   * Reenvio do convite (ou da confirmação de número) depois de falha do provedor.
   * Não consome a tentativa do candidato: a tentativa só conta a partir da primeira resposta.
   */
  async reenviarConvite(entrevistaId: string, tentativa: number): Promise<Record<string, unknown>> {
    return this.trava.executar(entrevistaId, async () => {
      const entrevista = await this.repo.buscarEntrevista(entrevistaId, SISTEMA);
      if (!entrevista) return { reenviado: false, motivo: 'ausente' };
      if (entrevista.iniciadaEm || triagemTerminal(entrevista.status)) return { reenviado: false, motivo: 'encerrada' };
      if (suspensa(entrevista.status)) return { reenviado: false, motivo: 'suspensa' };
      const contexto = lerContexto(entrevista.contexto);
      const tipo = contexto.reenvioPendente;
      if (!tipo) return { reenviado: false, motivo: 'sem_pendencia' };
      const perfil = await this.perfilDaEntrevista(entrevista);
      if (!perfil) return { reenviado: false, motivo: 'sem_perfil' };
      if (tipo === 'confirmacao_numero') {
        const envio = await this.tentarEnviar(entrevista, perfil, 'confirmacao_numero');
        if (!envio.ok && envio.transitoria) {
          const reenvioEm = await this.agendarReenvio(entrevista, perfil, tipo, tentativa + 1);
          return { reenviado: false, motivo: 'ENVIO_FALHOU', reenvioEm };
        }
        await this.repo.atualizarEntrevista(entrevista.id, { contexto: { ...contexto, reenvioPendente: null } }, SISTEMA);
        return { reenviado: envio.ok, motivo: envio.ok ? 'enviado' : 'recusado' };
      }
      const convite = await this.abrirConvite(entrevista, perfil, tentativa);
      return convite.ok
        ? { reenviado: true, motivo: 'enviado' }
        : { reenviado: false, motivo: 'ENVIO_FALHOU', reenvioEm: convite.reenvioEm };
    });
  }

  async processarEvento(eventoId: string): Promise<Record<string, unknown>> {
    const evento = await this.repo.buscarEventoWhatsappEntrada(eventoId, SISTEMA);
    if (!evento) return { status: 'ausente' };
    if (evento.status !== 'RECEBIDO') return { status: evento.status };
    const mensagem = evento.payloadNormalizado as unknown as MensagemEvento;
    const numero = String(mensagem.numeroRemetente ?? '');
    const perfil = numero ? await this.repo.buscarPerfilPorWhatsapp(numero) : null;
    const instancia = await this.repo.buscarInstanciaPorId(evento.instanciaWhatsappId, SISTEMA);
    if (!perfil || !instancia || instancia.empresaId !== evento.empresaId) {
      await this.repo.atualizarEventoWhatsappEntrada(evento.id, 'IGNORADO', SISTEMA);
      return { status: 'IGNORADO' };
    }
    const entrevista = await this.entrevistaAtiva(perfil.id, instancia.empresaId);
    if (!entrevista) {
      await this.repo.atualizarEventoWhatsappEntrada(evento.id, 'IGNORADO', SISTEMA);
      return { status: 'IGNORADO', motivo: 'sem_entrevista_na_empresa' };
    }
    return this.trava.executar(entrevista.id, () => this.tratar(entrevista.id, perfil, mensagem, evento.id));
  }

  async continuar(respostaId: string): Promise<Record<string, unknown>> {
    const resposta = await this.repo.buscarResposta(respostaId, SISTEMA);
    if (!resposta?.entrevistaId) return { status: 'ausente' };
    return this.trava.executar(resposta.entrevistaId, () => this.continuarDentro(resposta));
  }

  private async continuarDentro(resposta: RespostaSensivel): Promise<Record<string, unknown>> {
    const entrevista = await this.repo.buscarEntrevista(resposta.entrevistaId!, SISTEMA);
    if (!entrevista || triagemTerminal(entrevista.status)) return { status: 'encerrada' };
    await this.avaliacao.avaliar(resposta.id);
    const perguntas = await this.perguntas(entrevista.etapaId);
    const indice = perguntas.findIndex((item) => item.vinculo.id === resposta.etapaPerguntaId);
    if (indice < 0) return { status: 'sem_pergunta' };
    if (entrevista.perguntaAtual > indice) return { status: 'ja_continuada' };
    const perfil = await this.perfilDaEntrevista(entrevista);
    if (indice >= perguntas.length - 1) {
      await this.repo.atualizarEntrevista(entrevista.id, { status: 'CONCLUIDA', perguntaAtual: indice }, SISTEMA);
      await this.concluirCandidatura(entrevista);
      if (perfil) await this.promover(perfil.id, entrevista.empresaId);
      return { status: 'CONCLUIDA' };
    }
    const proxima = indice + 1;
    await this.repo.atualizarEntrevista(
      entrevista.id,
      { status: 'AGUARDANDO_RESPOSTA', perguntaAtual: proxima },
      SISTEMA,
    );
    if (perfil) await this.enviarPergunta(entrevista, perfil, perguntas, proxima);
    return { status: 'proxima', pergunta: proxima };
  }

  private async tratar(
    entrevistaId: string,
    perfil: PerfilCandidato,
    mensagem: MensagemEvento,
    eventoId: string,
  ): Promise<Record<string, unknown>> {
    const entrevista = await this.repo.buscarEntrevista(entrevistaId, SISTEMA);
    if (!entrevista || triagemTerminal(entrevista.status)) {
      await this.repo.atualizarEventoWhatsappEntrada(eventoId, 'IGNORADO', SISTEMA);
      return { status: 'IGNORADO' };
    }
    const idMensagem = String(mensagem.mensagemIdProvedor ?? '');
    if (idMensagem && (await this.repo.buscarRespostaPorMensagem(idMensagem, SISTEMA))) {
      await this.repo.atualizarEventoWhatsappEntrada(eventoId, 'PROCESSADO', SISTEMA);
      return { status: 'PROCESSADO', motivo: 'duplicada' };
    }
    const contexto = lerContexto(entrevista.contexto);
    const politica = await this.politica(entrevista);
    const pendente = await this.pendenteRecente(entrevista, politica.janelaAgregacaoSegundos);
    const decisao = decidirBorda(
      {
        aguardandoConfirmacaoNumero: contexto.aguardandoConfirmacaoNumero === true,
        aguardandoInicio: !entrevista.iniciadaEm,
        iniciada: entrevista.iniciadaEm !== null,
        pediuAudio: contexto.pediuAudio === true,
        respostaPendenteRecente: Boolean(pendente),
        audioMinimoSegundos: politica.audioMinimoSegundos,
      },
      {
        tipo: mensagem.tipo,
        texto: mensagem.texto,
        botaoId: mensagem.botaoId,
        duracaoSegundos: mensagem.duracaoSegundos,
      },
    );
    if (decisao.tipo === 'OPT_OUT') {
      await this.optOut(perfil, entrevista.empresaId);
      await this.repo.atualizarEventoWhatsappEntrada(eventoId, 'PROCESSADO', SISTEMA);
      return { status: 'PROCESSADO', decisao: decisao.tipo };
    }
    if (suspensa(entrevista.status)) {
      // Pausa da vaga/instância congela a triagem: nenhuma resposta muda o estado nem consome tentativa.
      await this.enviar(entrevista, perfil, 'adiar');
      await this.repo.atualizarEventoWhatsappEntrada(eventoId, 'PROCESSADO', SISTEMA);
      return { status: 'PROCESSADO', decisao: 'ADIAR', motivo: 'suspensa' };
    }
    if (decisao.tipo === 'CONFIRMAR_NUMERO') {
      await this.confirmarNumero(entrevista, perfil, decisao.aceito);
      await this.repo.atualizarEventoWhatsappEntrada(eventoId, 'PROCESSADO', SISTEMA);
      return { status: 'PROCESSADO', decisao: decisao.tipo, aceito: decisao.aceito };
    }
    if (decisao.tipo === 'ACEITAR_INICIO') {
      await this.aceitarInicio(entrevista, perfil);
      await this.repo.atualizarEventoWhatsappEntrada(eventoId, 'PROCESSADO', SISTEMA);
      return { status: 'PROCESSADO', decisao: decisao.tipo };
    }
    if (decisao.tipo === 'AGREGAR_AUDIO' && pendente && idMensagem) {
      await this.agregar(entrevista, contexto, idMensagem);
      await this.repo.atualizarEventoWhatsappEntrada(eventoId, 'PROCESSADO', SISTEMA);
      return { status: 'PROCESSADO', decisao: decisao.tipo };
    }
    if (decisao.tipo === 'ACEITAR_AUDIO' || decisao.tipo === 'ACEITAR_TEXTO') {
      const resultado = await this.registrarResposta(entrevista, perfil, mensagem, decisao.tipo === 'ACEITAR_TEXTO' ? decisao.texto : null);
      await this.repo.atualizarEventoWhatsappEntrada(eventoId, 'PROCESSADO', SISTEMA);
      return { status: 'PROCESSADO', ...resultado };
    }
    const tipoMensagem =
      decisao.tipo === 'PEDIR_AUDIO'
        ? 'pedir_audio'
        : decisao.tipo === 'AUDIO_CURTO'
          ? 'audio_curto'
          : decisao.tipo === 'MIDIA_INVALIDA'
            ? 'midia_invalida'
            : decisao.tipo === 'ADIAR'
              ? 'adiar'
              : decisao.tipo === 'REPETIR_CONFIRMACAO'
                ? 'confirmacao_numero'
                : 'nao_conta';
    if (decisao.tipo === 'PEDIR_AUDIO') {
      await this.repo.atualizarEntrevista(entrevista.id, { contexto: { ...contexto, pediuAudio: true } }, SISTEMA);
    }
    await this.enviar(entrevista, perfil, tipoMensagem);
    await this.repo.atualizarEventoWhatsappEntrada(eventoId, 'PROCESSADO', SISTEMA);
    return { status: 'PROCESSADO', decisao: decisao.tipo };
  }

  private async registrarResposta(
    entrevista: EntrevistaRegistro,
    _perfil: PerfilCandidato,
    mensagem: MensagemEvento,
    texto: string | null,
  ): Promise<Record<string, unknown>> {
    const agora = this.relogio.agora();
    const atual = await this.repo.buscarEntrevista(entrevista.id, SISTEMA);
    if (!atual || triagemTerminal(atual.status)) return { ignorado: true };
    const travada = await this.repo.atualizarEntrevista(
      atual.id,
      { ultimaInteracaoEm: agora, status: atual.iniciadaEm ? 'PROCESSANDO' : 'EM_ANDAMENTO' },
      SISTEMA,
      atual.atualizadoEm,
    );
    if (!travada) {
      const deNovo = await this.repo.buscarEntrevista(entrevista.id, SISTEMA);
      if (!deNovo || deNovo.status === 'ABANDONADA') return { ignorado: true, motivo: 'concorrência' };
    }
    const base = travada ?? (await this.repo.buscarEntrevista(entrevista.id, SISTEMA));
    if (!base || base.status === 'ABANDONADA') return { ignorado: true };
    const perguntas = await this.perguntas(base.etapaId);
    const vinculo = perguntas[base.perguntaAtual]?.vinculo ?? perguntas[0]?.vinculo;
    if (!vinculo) throw new ErroAplicacao('PROCESSO_SEM_PERGUNTAS', 422, 'etapa sem perguntas');
    const audio = texto === null;
    const resposta: RespostaSensivel = {
      id: randomUUID(),
      empresaId: base.empresaId,
      entrevistaId: base.id,
      etapaPerguntaId: vinculo.id,
      tipo: audio ? 'AUDIO_WHATSAPP' : 'TEXTO_WHATSAPP',
      textoOriginal: texto,
      audioUrl: null,
      transcricao: audio ? null : texto,
      mensagemIdProvedor: String(mensagem.mensagemIdProvedor ?? ''),
      duracaoSegundos: mensagem.duracaoSegundos,
      statusTranscricao: audio ? 'PENDENTE' : 'CONCLUIDA',
      confiancaTranscricao: audio ? null : 1,
      revisaoHumanaNecessaria: !audio,
      parcial: false,
      expirou: false,
      tempoUsado: null,
      criadoEm: agora,
    };
    await this.repo.criarResposta(resposta);
    const iniciada = await this.repo.buscarEntrevista(base.id, SISTEMA);
    if (iniciada && !iniciada.iniciadaEm) {
      await this.repo.atualizarEntrevista(
        iniciada.id,
        { iniciadaEm: agora, ultimaInteracaoEm: agora, status: audio ? 'PROCESSANDO' : 'EM_ANDAMENTO' },
        SISTEMA,
      );
    }
    const vigente = await this.repo.buscarEntrevista(base.id, SISTEMA);
    if (vigente) {
      const lembrete = momentoLembreteInatividade(vigente, inatividadeDaPolitica(await this.politica(vigente)));
      if (lembrete) await this.retries.agendarInatividade(vigente, lembrete.getTime() - agora.getTime());
    }
    if (audio) {
      await this.fila.agendar({
        fila: FILA_STT,
        nome: 'transcrever',
        jobId: `stt-${resposta.id}`,
        delayMs: 0,
        data: { respostaId: resposta.id },
      });
      return { respostaId: resposta.id, transcricao: 'agendada' };
    }
    await this.continuarDentro(resposta);
    return { respostaId: resposta.id, transcricao: 'texto' };
  }

  private async agregar(entrevista: EntrevistaRegistro, contexto: ContextoEntrevista, mensagemId: string): Promise<void> {
    const agora = this.relogio.agora();
    await this.repo.atualizarEntrevista(
      entrevista.id,
      {
        ultimaInteracaoEm: agora,
        contexto: { ...contexto, audiosAgregados: [...(contexto.audiosAgregados ?? []), mensagemId] },
      },
      SISTEMA,
    );
  }

  private async aceitarInicio(entrevista: EntrevistaRegistro, perfil: PerfilCandidato): Promise<void> {
    const agora = this.relogio.agora();
    if (entrevista.iniciadaEm) throw new ErroAplicacao('TENTATIVA_CONSUMIDA', 409, 'tentativa já consumida');
    if (suspensa(entrevista.status)) throw new ErroAplicacao('ENTREVISTA_SUSPENSA', 409, 'entrevista suspensa');
    await this.repo.atualizarEntrevista(
      entrevista.id,
      { aceiteTentativaEm: entrevista.aceiteTentativaEm ?? agora, status: 'ACEITE_REGISTRADO', perguntaAtual: 0 },
      SISTEMA,
    );
    const perguntas = await this.perguntas(entrevista.etapaId);
    await this.enviarPergunta(entrevista, perfil, perguntas, 0);
  }

  private async confirmarNumero(entrevista: EntrevistaRegistro, perfil: PerfilCandidato, aceito: boolean): Promise<void> {
    const contexto = lerContexto(entrevista.contexto);
    if (!aceito) {
      await this.repo.atualizarEntrevista(
        entrevista.id,
        { contexto: { ...contexto, aguardandoConfirmacaoNumero: false, numeroRecusado: true } },
        SISTEMA,
      );
      return;
    }
    await this.repo.salvarPerfil({
      ...perfil,
      whatsappVerificado: true,
      whatsappVerificadoEm: this.relogio.agora(),
    });
    await this.repo.atualizarEntrevista(
      entrevista.id,
      { contexto: { ...contexto, aguardandoConfirmacaoNumero: false } },
      SISTEMA,
    );
    const atual = await this.repo.buscarEntrevista(entrevista.id, SISTEMA);
    if (atual) await this.abrirConvite(atual, { ...perfil, whatsappVerificado: true });
  }

  private async abrirConvite(
    entrevista: EntrevistaRegistro,
    perfil: PerfilCandidato,
    tentativaAtual = 0,
  ): Promise<{ ok: true } | { ok: false; reenvioEm: string | null }> {
    const candidatura = await this.repo.buscarCandidatura(entrevista.candidaturaId, SISTEMA);
    if (candidatura?.status === 'INSCRITA') {
      await this.candidaturas.aplicar(
        candidatura.id,
        { tipo: 'iniciarTriagem' },
        { autorId: null, motivo: 'convite da triagem WhatsApp' },
        { empresaId: entrevista.empresaId },
      );
    }
    const envio = await this.tentarEnviar(entrevista, perfil, 'convite');
    if (!envio.ok && envio.transitoria) {
      return { ok: false, reenvioEm: await this.agendarReenvio(entrevista, perfil, 'convite', tentativaAtual + 1) };
    }
    const atual = (await this.repo.buscarEntrevista(entrevista.id, SISTEMA)) ?? entrevista;
    if (envio.ok) {
      const contexto = lerContexto(atual.contexto);
      const gravada = await this.repo.atualizarEntrevista(
        atual.id,
        { contexto: { ...contexto, conviteEnviadoEm: this.relogio.agora().toISOString(), reenvioPendente: null } },
        SISTEMA,
      );
      await this.retries.agendarProximo(gravada ?? atual);
    } else {
      await this.retries.agendarProximo(atual);
    }
    return { ok: true };
  }

  /** Envia sem propagar falha do provedor: erro ou rate limit são transitórios e pedem reenvio. */
  private async tentarEnviar(
    entrevista: EntrevistaRegistro,
    perfil: PerfilCandidato,
    tipo: 'convite' | 'confirmacao_numero',
  ): Promise<{ ok: true } | { ok: false; transitoria: boolean }> {
    try {
      const resultado = await this.enviar(entrevista, perfil, tipo);
      if (!resultado || resultado.ok) return { ok: true };
      return { ok: false, transitoria: resultado.motivo === 'RATE_LIMIT' };
    } catch {
      return { ok: false, transitoria: true };
    }
  }

  /**
   * Agenda o reenvio `tentativa` (1-based) com backoff. Esgotadas as tentativas, alerta a empresa e volta ao
   * ciclo normal de lembretes/esgotamento da triagem. Devolve o instante agendado (ISO) ou null.
   */
  private async agendarReenvio(
    entrevista: EntrevistaRegistro,
    _perfil: PerfilCandidato,
    tipo: 'convite' | 'confirmacao_numero',
    tentativa: number,
  ): Promise<string | null> {
    const atual = (await this.repo.buscarEntrevista(entrevista.id, SISTEMA)) ?? entrevista;
    const contexto = lerContexto(atual.contexto);
    const atraso = atrasoReenvioConviteMs(tentativa);
    if (atraso === null) {
      const gravada = await this.repo.atualizarEntrevista(atual.id, { contexto: { ...contexto, reenvioPendente: null } }, SISTEMA);
      await this.alertar(atual.empresaId, atual.candidaturaId, 'TRIAGEM_ENVIO_FALHOU');
      await this.retries.agendarProximo(gravada ?? atual);
      return null;
    }
    await this.repo.atualizarEntrevista(atual.id, { contexto: { ...contexto, reenvioPendente: tipo } }, SISTEMA);
    await this.fila.agendar({
      fila: FILA_TRIAGEM_RETRY,
      nome: 'reenviar-convite',
      jobId: `reenvio:${atual.id}:${tentativa}`,
      delayMs: atraso,
      data: { entrevistaId: atual.id, tentativa },
    });
    return new Date(this.relogio.agora().getTime() + atraso).toISOString();
  }

  private async optOut(perfil: PerfilCandidato, empresaId: string): Promise<void> {
    const agora = this.relogio.agora();
    for (const tipo of ['WHATSAPP', 'AUDIO_WHATSAPP'] as const) {
      await this.repo.registrarConsentimento({
        id: randomUUID(),
        candidatoId: perfil.id,
        tipo,
        concedido: false,
        versaoTermo: 'opt-out-parar',
        criadoEm: agora,
      });
    }
    const entrevistas = await this.entrevistasDoCandidato(perfil.id, empresaId);
    for (const entrevista of entrevistas) {
      if (triagemTerminal(entrevista.status)) continue;
      await this.repo.atualizarEntrevista(
        entrevista.id,
        { status: entrevista.iniciadaEm ? 'CANCELADA' : 'RECUSADA' },
        SISTEMA,
      );
    }
    const dados = await this.nomes(empresaId, entrevistas[0]?.candidaturaId);
    if (dados && perfil.whatsapp) {
      await this.enviador.enviar({
        empresaId,
        candidatoId: perfil.id,
        numero: perfil.whatsapp,
        texto: mensagemFluxoTriagem('opt_out', dados).texto,
        excecaoOptOut: true,
      });
    }
  }

  private async concluirCandidatura(entrevista: EntrevistaRegistro): Promise<void> {
    const candidatura = await this.repo.buscarCandidatura(entrevista.candidaturaId, SISTEMA);
    if (candidatura?.status !== 'TRIAGEM_WHATSAPP') return;
    await this.candidaturas.aplicar(
      candidatura.id,
      { tipo: 'concluirTriagem' },
      { autorId: null, motivo: 'triagem WhatsApp concluída' },
      { empresaId: entrevista.empresaId },
    );
  }

  private async promover(candidatoId: string, empresaId: string): Promise<void> {
    const aguardando = (await this.entrevistasDoCandidato(candidatoId, empresaId)).find(
      (item) => item.status === 'AGENDADA',
    );
    if (!aguardando) return;
    const perfil = await this.perfil(candidatoId);
    if (!perfil) return;
    await this.repo.atualizarEntrevista(aguardando.id, { status: 'AGUARDANDO_INICIO' }, SISTEMA);
    const atual = await this.repo.buscarEntrevista(aguardando.id, SISTEMA);
    if (atual) await this.abrirConvite(atual, perfil);
  }

  private async enviar(
    entrevista: EntrevistaRegistro,
    perfil: PerfilCandidato,
    tipo: 'convite' | 'confirmacao_numero' | 'pedir_audio' | 'audio_curto' | 'midia_invalida' | 'nao_conta' | 'adiar',
  ): Promise<ResultadoEnvio | null> {
    const dados = await this.nomes(entrevista.empresaId, entrevista.candidaturaId);
    if (!dados) return null;
    if (tipo === 'convite') {
      const menu = mensagemTriagem('convite_triagem', dados);
      return this.enviador.enviar({
        empresaId: entrevista.empresaId,
        candidatoId: perfil.id,
        numero: perfil.whatsapp,
        texto: menu.texto,
        opcoes: menu.opcoes,
      });
    }
    const fluxo = mensagemFluxoTriagem(tipo, { ...dados, nomeCandidato: perfil.nome });
    return this.enviador.enviar({
      empresaId: entrevista.empresaId,
      candidatoId: perfil.id,
      numero: perfil.whatsapp,
      texto: fluxo.texto,
      opcoes: fluxo.opcoes,
    });
  }

  private async enviarPergunta(
    entrevista: EntrevistaRegistro,
    perfil: PerfilCandidato,
    perguntas: Array<{ vinculo: { id: string }; enunciado: string }>,
    indice: number,
  ): Promise<void> {
    const dados = await this.nomes(entrevista.empresaId, entrevista.candidaturaId);
    const pergunta = perguntas[indice];
    if (!dados || !pergunta) return;
    const fluxo = mensagemFluxoTriagem('pergunta', {
      ...dados,
      enunciado: pergunta.enunciado,
      ordem: indice + 1,
      total: perguntas.length,
    });
    await this.enviador.enviar({
      empresaId: entrevista.empresaId,
      candidatoId: perfil.id,
      numero: perfil.whatsapp,
      texto: fluxo.texto,
    });
  }

  private async pendenteRecente(entrevista: EntrevistaRegistro, janelaSegundos: number): Promise<RespostaSensivel | null> {
    const agora = this.relogio.agora();
    const respostas = await this.repo.listarRespostasEntrevista(entrevista.id, SISTEMA);
    return (
      respostas.find(
        (item) =>
          item.tipo === 'AUDIO_WHATSAPP' &&
          item.statusTranscricao === 'PENDENTE' &&
          item.criadoEm &&
          dentroDaJanelaAgregacao(item.criadoEm, agora, janelaSegundos),
      ) ?? null
    );
  }

  private async conversaOcupada(candidatoId: string, empresaId: string): Promise<boolean> {
    return (await this.entrevistasDoCandidato(candidatoId, empresaId)).some(
      (item) => !triagemTerminal(item.status) && item.status !== 'AGENDADA',
    );
  }

  private async entrevistaAtiva(candidatoId: string, empresaId: string): Promise<EntrevistaRegistro | null> {
    const ativas = (await this.entrevistasDoCandidato(candidatoId, empresaId)).filter(
      (item) => !triagemTerminal(item.status) && item.status !== 'AGENDADA',
    );
    const prioridade: StatusEntrevista[] = [
      'PROCESSANDO',
      'AGUARDANDO_RESPOSTA',
      'EM_ANDAMENTO',
      'ACEITE_REGISTRADO',
      'RETRY_3',
      'RETRY_2',
      'RETRY_1',
      'AGUARDANDO_INICIO',
      'SUSPENSA_INSTANCIA',
      'SUSPENSA_PAUSA',
    ];
    return ativas.sort((a, b) => prioridade.indexOf(a.status) - prioridade.indexOf(b.status))[0] ?? null;
  }

  private async entrevistasDoCandidato(candidatoId: string, empresaId: string): Promise<EntrevistaRegistro[]> {
    const candidaturas = (await this.repo.listarCandidaturasCandidato(candidatoId, SISTEMA)).filter(
      (item) => item.empresaId === empresaId,
    );
    const ids = new Set(candidaturas.map((item) => item.id));
    return (await this.repo.listarEntrevistas(SISTEMA)).filter((item) => ids.has(item.candidaturaId));
  }

  private async etapaTriagem(vagaId: string) {
    const processo = await this.repo.buscarProcessoPorVaga(vagaId, SISTEMA);
    if (!processo) throw new ErroAplicacao('PROCESSO_AUSENTE', 422, 'vaga sem processo seletivo');
    const etapa = (await this.repo.listarEtapas(processo.id, SISTEMA)).find((item) => item.tipo === 'TRIAGEM_WHATSAPP');
    if (!etapa) throw new ErroAplicacao('ETAPA_AUSENTE', 422, 'vaga sem triagem WhatsApp');
    return etapa;
  }

  private async perguntas(etapaId: string) {
    const vinculos = [...(await this.repo.listarVinculosEtapa(etapaId, SISTEMA))].sort((a, b) => a.ordem - b.ordem);
    const saida = [];
    for (const vinculo of vinculos) {
      const pergunta = await this.repo.buscarPergunta(vinculo.perguntaId, SISTEMA);
      saida.push({ vinculo, enunciado: pergunta?.enunciado ?? '' });
    }
    return saida;
  }

  private async politica(entrevista: EntrevistaRegistro) {
    const candidatura = await this.repo.buscarCandidatura(entrevista.candidaturaId, SISTEMA);
    const processo = candidatura ? await this.repo.buscarProcessoPorVaga(candidatura.vagaId, SISTEMA) : null;
    return politicaTriagemEfetiva(processo?.politicaRetry);
  }

  private async temOptIn(candidatoId: string): Promise<boolean> {
    const vigentes = consentimentosVigentes(await this.repo.listarConsentimentos(candidatoId));
    const whatsapp = vigentes.some((item) => item.tipo === 'WHATSAPP' && item.concedido);
    const audio = vigentes.some((item) => item.tipo === 'AUDIO_WHATSAPP' && item.concedido);
    return whatsapp && audio;
  }

  private async perfil(candidatoId: string): Promise<PerfilCandidato | null> {
    const candidato = await this.repo.buscarCandidatoPorId(candidatoId);
    if (!candidato) return null;
    return this.repo.obterPerfil(candidato.usuarioId);
  }

  private async perfilDaEntrevista(entrevista: EntrevistaRegistro): Promise<PerfilCandidato | null> {
    const candidatura = await this.repo.buscarCandidatura(entrevista.candidaturaId, SISTEMA);
    if (!candidatura) return null;
    return this.perfil(candidatura.candidatoId);
  }

  private async nomes(empresaId: string, candidaturaId?: string) {
    const empresa = await this.repo.buscarEmpresaPorId(empresaId, SISTEMA);
    const candidatura = candidaturaId ? await this.repo.buscarCandidatura(candidaturaId, SISTEMA) : null;
    const vaga = candidatura ? await this.repo.buscarVaga(candidatura.vagaId, SISTEMA) : null;
    if (!empresa || !vaga) return null;
    return { nomeVaga: vaga.titulo, nomeEmpresa: empresa.nomeFantasia };
  }

  private async alertar(empresaId: string, candidaturaId: string, codigo: string): Promise<void> {
    const membros = await this.repo.listarMembros(empresaId, SISTEMA);
    const agora = this.relogio.agora();
    for (const membro of membros) {
      if (!membro.papeis.includes('ADMIN_EMPRESA') && !membro.papeis.includes('RECRUTADOR')) continue;
      await this.repo.inserirNotificacaoUnica(
        {
          id: randomUUID(),
          usuarioId: membro.usuarioId,
          empresaId,
          tipo: 'OPERACIONAL',
          chaveDedup: `${codigo}:${candidaturaId}:${membro.usuarioId}`,
          dados: { candidaturaId, empresaId, codigo, central: true },
          criadoEm: agora,
        },
        { empresaId },
      );
    }
  }
}
