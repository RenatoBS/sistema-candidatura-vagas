import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import {
  avaliarAviso,
  avaliarReconexao,
  concederExcecao,
  consentimentosVigentes,
  decidirAdmissao,
  decidirTurno,
  JANELA_RECONEXAO_MS_PADRAO,
  pausarTimer,
  retomarTimer,
  rotuloAmigavel,
  tempoRestanteSegundos,
  VOZ_MAX_SESSOES_SIMULTANEAS,
  type EstadoVoz,
  type StatusCandidatura,
} from '@scv/domain';
import type { Armazenamento } from '@scv/providers';

import { AuditoriaService } from '../auditoria/auditoria.service';
import type { Relogio } from '../auth/auth.service';
import { CandidaturaStateMachine } from '../candidaturas/candidatura-state-machine';
import { ErroAplicacao } from '../erros';
import type { EntrevistaRegistro, SessaoVozRegistro } from '../repositorio/entrevistas-tipos';
import type { Repositorio } from '../repositorio/tipos';
import { ctxDe, exigir, montarAtor, papelAuditoria, type SessaoRequest } from '../sessao';
import { ARMAZENAMENTO, RELOGIO, REPOSITORIO } from '../tokens';
import { medirPipelineFake } from './pipeline-fake';

const SISTEMA = { sistema: true as const };
const EXPIRA_GRAVACAO_SEGUNDOS = 60;

interface ItemRoteiro {
  etapaPerguntaId: string;
  ordem: number;
  enunciado: string;
  tempoLimiteSegundos: number;
}

@Injectable()
export class VozService {
  constructor(
    @Inject(REPOSITORIO) private readonly repo: Repositorio,
    @Inject(RELOGIO) private readonly relogio: Relogio,
    @Inject(CandidaturaStateMachine) private readonly candidaturas: CandidaturaStateMachine,
    @Inject(ARMAZENAMENTO) private readonly armazenamento: Armazenamento,
    @Inject(AuditoriaService) private readonly auditoria: AuditoriaService,
  ) {}

  async preparar(candidaturaId: string) {
    const candidatura = await this.repo.buscarCandidatura(candidaturaId, SISTEMA);
    if (!candidatura) throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'candidatura não encontrada');
    const vaga = await this.repo.buscarVaga(candidatura.vagaId, SISTEMA);
    if (!vaga || vaga.status === 'PAUSADA' || vaga.status === 'FECHADA') {
      throw new ErroAplicacao('VAGA_INDISPONIVEL', 409, 'vaga pausada ou fechada');
    }
    await this.exigirGravacao(candidatura.candidatoId);
    const etapa = await this.etapaVoz(candidatura.vagaId);
    const existente = await this.repo.buscarEntrevistaPorCandidaturaEtapa(candidaturaId, etapa.id, SISTEMA);
    if (existente) {
      if (this.tentativaConsumida(existente)) {
        throw new ErroAplicacao('TENTATIVA_CONSUMIDA', 409, 'tentativa já consumida');
      }
      return this.resumo(existente);
    }
    const agora = this.relogio.agora();
    const criada = await this.repo.criarEntrevista(
      {
        id: randomUUID(),
        empresaId: candidatura.empresaId,
        candidaturaId,
        etapaId: etapa.id,
        canal: 'VOZ_TEMPO_REAL',
        status: 'DISPONIVEL',
        retryAtual: 0,
        perguntaAtual: 0,
        iniciadaEm: null,
        ultimaInteracaoEm: null,
        proximoRetryEm: null,
        aceiteTentativaEm: null,
        excecaoConcedida: false,
        encerrarAoFim: false,
        contexto: {},
        criadoEm: agora,
        atualizadoEm: agora,
      },
      SISTEMA,
    );
    return this.resumo(criada);
  }

  async aceitar(entrevistaId: string) {
    const entrevista = await this.exigirEntrevista(entrevistaId);
    if (entrevista.iniciadaEm || !['DISPONIVEL', 'ACEITE_REGISTRADO'].includes(entrevista.status)) {
      throw new ErroAplicacao('TENTATIVA_CONSUMIDA', 409, 'segunda tentativa rejeitada');
    }
    const ativas = await this.repo.contarSessoesAtivas(SISTEMA);
    if (decidirAdmissao(ativas, this.maxSessoes()) === 'fila') {
      throw new ErroAplicacao('FILA_ADMISSAO', 429, 'fila de admissão da voz');
    }
    const candidatura = await this.repo.buscarCandidatura(entrevista.candidaturaId, SISTEMA);
    if (!candidatura) throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'candidatura não encontrada');
    if (candidatura.status === 'TRIAGEM_CONCLUIDA') {
      await this.candidaturas.aplicar(candidatura.id, { tipo: 'iniciarEntrevistaVoz' }, { autorId: null, motivo: 'aceite da voz' }, SISTEMA);
    }
    const agora = this.relogio.agora();
    const roteiro = await this.roteiro(entrevista);
    const primeira = roteiro[0];
    if (!primeira) throw new ErroAplicacao('ROTEIRO_VAZIO', 409, 'etapa sem perguntas');
    const estado: EstadoVoz = {
      indice: 0,
      inicioPerguntaEm: agora.toISOString(),
      pausadoMs: 0,
      pausadoEm: null,
      followUpUsado: false,
      avisoEnviado: false,
      rascunho: null,
    };
    const sessao = await this.repo.criarSessaoVoz(
      {
        id: randomUUID(),
        entrevistaId,
        salaId: `sala-${randomUUID()}`,
        status: 'ATIVA',
        inicioEm: agora,
        fimEm: null,
        desconectadoEm: null,
        motivoFim: null,
        gravacaoKey: `empresas/${entrevista.empresaId}/entrevistas/${entrevistaId}/voz/sessao.ogg`,
        criadoEm: agora,
        atualizadoEm: agora,
      },
      SISTEMA,
    );
    await this.repo.atualizarEntrevista(
      entrevistaId,
      {
        status: 'EM_SESSAO',
        iniciadaEm: agora,
        aceiteTentativaEm: agora,
        ultimaInteracaoEm: agora,
        perguntaAtual: 0,
        contexto: { ...(entrevista.contexto ?? {}), voz: estado },
        atualizadoEm: agora,
      },
      SISTEMA,
    );
    return {
      sessaoId: sessao.id,
      salaId: sessao.salaId,
      token: `lk_fake_${sessao.id}`,
      url: 'ws://localhost/livekit',
      enunciado: primeira.enunciado,
      segundosRestantes: primeira.tempoLimiteSegundos,
      aviso: false,
    };
  }

  async turno(sessaoId: string, texto: string) {
    const { sessao, entrevista } = await this.sessaoAtiva(sessaoId);
    const estado = this.estadoDe(entrevista);
    const roteiro = await this.roteiro(entrevista);
    const agora = this.relogio.agora();
    const pipeline = await medirPipelineFake(texto);
    const decisao = decidirTurno({
      perguntas: roteiro.map((item) => ({
        ordem: item.ordem,
        enunciado: item.enunciado,
        tempoLimiteSegundos: item.tempoLimiteSegundos,
      })),
      estado,
      agora,
      texto,
    });
    if (decisao.acao === 'followup') {
      await this.salvarEstado(entrevista, decisao.estado, agora);
      return {
        acao: 'followup' as const,
        enunciado: decisao.enunciado,
        segundosRestantes: this.restante(decisao.estado, roteiro, agora),
        aviso: avaliarAviso(this.restante(decisao.estado, roteiro, agora)) === 'avisar',
        etapas: pipeline.etapas,
        totalMs: pipeline.totalMs,
      };
    }
    if (decisao.acao === 'expirar') {
      return this.avancarExpirada(entrevista, sessao, roteiro, estado, agora, pipeline);
    }
    await this.gravarResposta(entrevista, roteiro[decisao.indice], decisao.texto, {
      expirou: false,
      parcial: false,
      tempoUsado: decisao.tempoUsado,
    });
    if (!decisao.proxima) return this.concluir(entrevista, sessao, agora, pipeline, 'CONCLUIDA');
    await this.salvarEstado(entrevista, decisao.estado, agora, decisao.estado.indice);
    return {
      acao: 'pergunta' as const,
      enunciado: decisao.proxima.enunciado,
      segundosRestantes: decisao.proxima.tempoLimiteSegundos,
      aviso: false,
      etapas: pipeline.etapas,
      totalMs: pipeline.totalMs,
    };
  }

  async expirar(sessaoId: string) {
    const { sessao, entrevista } = await this.sessaoAtiva(sessaoId);
    const estado = this.estadoDe(entrevista);
    const roteiro = await this.roteiro(entrevista);
    const agora = this.relogio.agora();
    const atual = roteiro[estado.indice];
    if (!atual) return this.concluir(entrevista, sessao, agora, await medirPipelineFake(''), 'CONCLUIDA');
    const restante = tempoRestanteSegundos(estado, agora, atual.tempoLimiteSegundos);
    if (restante > 0) throw new ErroAplicacao('AINDA_NO_PRAZO', 409, 'a pergunta ainda está no prazo');
    const pipeline = await medirPipelineFake(estado.rascunho ?? '');
    return this.avancarExpirada(entrevista, sessao, roteiro, estado, agora, pipeline);
  }

  async desconectar(sessaoId: string) {
    const { entrevista } = await this.sessaoAtiva(sessaoId);
    const agora = this.relogio.agora();
    const estado = pausarTimer(this.estadoDe(entrevista), agora);
    await this.repo.atualizarSessaoVoz(
      sessaoId,
      { status: 'RECONECTANDO', desconectadoEm: agora, atualizadoEm: agora },
      SISTEMA,
    );
    await this.salvarEstado(entrevista, estado, agora, undefined, 'RECONECTANDO');
    return { status: 'RECONECTANDO' as const, janelaMs: await this.janelaMs(entrevista) };
  }

  async reconectar(sessaoId: string) {
    const sessao = await this.repo.buscarSessaoVoz(sessaoId, SISTEMA);
    if (!sessao || sessao.status !== 'RECONECTANDO' || !sessao.desconectadoEm) {
      throw new ErroAplicacao('SESSAO_INVALIDA', 409, 'não há queda para reconectar');
    }
    const entrevista = await this.exigirEntrevista(sessao.entrevistaId);
    const agora = this.relogio.agora();
    const janela = await this.janelaMs(entrevista);
    if (avaliarReconexao(sessao.desconectadoEm, agora, janela) === 'abandonar') {
      await this.abandonar(entrevista, sessao, agora, 'janela de reconexão esgotada');
      return { status: 'ABANDONADA' as const, mesmaSessao: false };
    }
    const estado = retomarTimer(this.estadoDe(entrevista), agora);
    await this.repo.atualizarSessaoVoz(
      sessaoId,
      { status: 'ATIVA', desconectadoEm: null, atualizadoEm: agora },
      SISTEMA,
    );
    await this.salvarEstado(entrevista, estado, agora, undefined, 'EM_SESSAO');
    const roteiro = await this.roteiro(entrevista);
    return {
      status: 'EM_SESSAO' as const,
      mesmaSessao: true,
      sessaoId: sessao.id,
      enunciado: roteiro[estado.indice]?.enunciado ?? null,
      segundosRestantes: this.restante(estado, roteiro, agora),
    };
  }

  async encerrar(sessaoId: string) {
    const { sessao, entrevista } = await this.sessaoAtiva(sessaoId);
    const agora = this.relogio.agora();
    await this.abandonar(entrevista, sessao, agora, 'encerramento voluntário');
    return { status: 'ABANDONADA' as const };
  }

  async excecao(sessaoReq: SessaoRequest, empresaId: string, entrevistaId: string, motivo: string) {
    if (!motivo.trim()) throw new ErroAplicacao('MOTIVO_OBRIGATORIO', 400, 'motivo obrigatório');
    const alinhada = await this.alinhar(sessaoReq, empresaId);
    exigir(alinhada, 'revisao_humana');
    const ctx = ctxDe(alinhada, empresaId);
    const entrevista = await this.repo.buscarEntrevista(entrevistaId, ctx);
    if (!entrevista || entrevista.empresaId !== empresaId || entrevista.status !== 'ABANDONADA') {
      throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'entrevista não encontrada');
    }
    const decisao = concederExcecao(entrevista.excecaoConcedida);
    if (!decisao.ok) throw new ErroAplicacao(decisao.codigo, 409, 'exceção já concedida');
    const agora = this.relogio.agora();
    await this.candidaturas.aplicar(
      entrevista.candidaturaId,
      { tipo: 'concederExcecaoVoz' },
      { autorId: alinhada.usuario.id, motivo: motivo.trim() },
      ctx,
    );
    await this.repo.atualizarEntrevista(
      entrevistaId,
      {
        status: 'DISPONIVEL',
        iniciadaEm: null,
        aceiteTentativaEm: null,
        excecaoConcedida: true,
        perguntaAtual: 0,
        contexto: {},
        atualizadoEm: agora,
      },
      ctx,
    );
    await this.auditoria.registrar(
      {
        usuarioId: alinhada.usuario.id,
        empresaId,
        papel: papelAuditoria(alinhada),
        acao: 'CONCEDER_EXCECAO_VOZ',
        recursoTipo: 'ENTREVISTA',
        recursoId: entrevistaId,
        motivo: motivo.trim(),
      },
      ctx,
    );
    return { excecaoConcedida: true };
  }

  async listar(sessaoReq: SessaoRequest, empresaId: string, vagaId: string) {
    const alinhada = await this.alinhar(sessaoReq, empresaId);
    exigir(alinhada, 'ver_audio_transcricao');
    const ctx = ctxDe(alinhada, empresaId);
    const vaga = await this.repo.buscarVaga(vagaId, ctx);
    if (!vaga || vaga.empresaId !== empresaId) throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'vaga não encontrada');
    const candidaturas = await this.repo.listarCandidaturasVaga(vagaId, ctx);
    const ids = new Set(candidaturas.map((item) => item.id));
    const entrevistas = await this.repo.listarEntrevistas(ctx);
    return {
      itens: entrevistas
        .filter((item) => ids.has(item.candidaturaId) && item.canal === 'VOZ_TEMPO_REAL')
        .map((item) => this.resumo(item)),
    };
  }

  async detalhe(sessaoReq: SessaoRequest, empresaId: string, entrevistaId: string) {
    const alinhada = await this.alinhar(sessaoReq, empresaId);
    exigir(alinhada, 'ver_audio_transcricao');
    const ctx = ctxDe(alinhada, empresaId);
    const entrevista = await this.repo.buscarEntrevista(entrevistaId, ctx);
    if (!entrevista || entrevista.empresaId !== empresaId || entrevista.canal !== 'VOZ_TEMPO_REAL') {
      throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'entrevista não encontrada');
    }
    const respostas = await this.repo.listarRespostasEntrevista(entrevistaId, ctx);
    const sessoes = await this.repo.listarSessoesEntrevista(entrevistaId, ctx);
    const itens = [];
    for (const resposta of respostas) {
      const avaliacoes = await this.repo.listarAvaliacoes(resposta.id, ctx);
      const humana = [...avaliacoes].reverse().find((item) => item.avaliador === 'HUMANO');
      const ia = avaliacoes.find((item) => item.avaliador === 'IA');
      const exibida = humana ?? ia ?? null;
      itens.push({
        id: resposta.id,
        transcricao: resposta.transcricao,
        expirou: resposta.expirou ?? false,
        parcial: resposta.parcial ?? false,
        tempoUsado: resposta.tempoUsado ?? null,
        nota: exibida?.nota ?? null,
        notaOrigem: exibida?.avaliador ?? null,
      });
    }
    return {
      ...this.resumo(entrevista),
      gravacaoDisponivel: sessoes.some((item) => Boolean(item.gravacaoKey)),
      respostas: itens,
    };
  }

  async revisar(
    sessaoReq: SessaoRequest,
    empresaId: string,
    entrevistaId: string,
    respostaId: string,
    entrada: { nota: number; justificativa: string },
  ) {
    const alinhada = await this.alinhar(sessaoReq, empresaId);
    exigir(alinhada, 'revisao_humana');
    const ctx = ctxDe(alinhada, empresaId);
    const resposta = await this.repo.buscarResposta(respostaId, ctx);
    if (!resposta || resposta.empresaId !== empresaId || resposta.entrevistaId !== entrevistaId) {
      throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'resposta não encontrada');
    }
    if (entrada.nota < 0 || entrada.nota > 10) throw new ErroAplicacao('NOTA_INVALIDA', 400, 'nota entre 0 e 10');
    await this.repo.salvarAvaliacao(
      {
        id: randomUUID(),
        respostaId,
        avaliador: 'HUMANO',
        nota: entrada.nota,
        criterios: { contaNaMedia: true, origem: 'revisao-voz' },
        justificativa: entrada.justificativa,
        modelo: null,
        versaoPrompt: null,
        criadoEm: this.relogio.agora(),
      },
      ctx,
    );
    return this.detalhe(sessaoReq, empresaId, entrevistaId);
  }

  async gravacao(sessaoReq: SessaoRequest, empresaId: string, entrevistaId: string, motivo?: string) {
    if (!motivo?.trim()) throw new ErroAplicacao('MOTIVO_OBRIGATORIO', 400, 'motivo obrigatório');
    const alinhada = await this.alinhar(sessaoReq, empresaId);
    exigir(alinhada, 'ver_audio_transcricao');
    const ctx = ctxDe(alinhada, empresaId);
    const entrevista = await this.repo.buscarEntrevista(entrevistaId, ctx);
    const sessoes = entrevista ? await this.repo.listarSessoesEntrevista(entrevistaId, ctx) : [];
    const gravacaoKey = sessoes.find((item) => item.gravacaoKey)?.gravacaoKey;
    if (!entrevista || entrevista.empresaId !== empresaId || !gravacaoKey) {
      throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'gravação não encontrada');
    }
    await this.auditoria.registrar(
      {
        usuarioId: alinhada.usuario.id,
        empresaId,
        papel: papelAuditoria(alinhada),
        acao: 'LER_AUDIO',
        recursoTipo: 'GRAVACAO',
        recursoId: entrevistaId,
        motivo: motivo.trim(),
      },
      ctx,
    );
    return {
      url: await this.armazenamento.criarUrlDownload(gravacaoKey, EXPIRA_GRAVACAO_SEGUNDOS),
      expiraEmSegundos: EXPIRA_GRAVACAO_SEGUNDOS,
    };
  }

  async visao(entrevistaId: string) {
    const entrevista = await this.exigirEntrevista(entrevistaId);
    const candidatura = await this.repo.buscarCandidatura(entrevista.candidaturaId, SISTEMA);
    const roteiro = await this.roteiro(entrevista);
    const estado = entrevista.contexto?.voz ?? null;
    const restante = estado ? this.restante(estado, roteiro, this.relogio.agora()) : (roteiro[0]?.tempoLimiteSegundos ?? 0);
    return {
      status: entrevista.status,
      rotulo: candidatura ? rotuloAmigavel(candidatura.status as StatusCandidatura) : null,
      pergunta: roteiro[estado?.indice ?? 0]?.enunciado ?? null,
      segundosRestantes: Math.max(0, restante),
      aviso: Boolean(estado) && avaliarAviso(restante) === 'avisar',
      reconectando: entrevista.status === 'RECONECTANDO',
    };
  }

  async garantirDonoEntrevista(usuarioId: string, entrevistaId: string): Promise<void> {
    const entrevista = await this.exigirEntrevista(entrevistaId);
    await this.garantirDonoCandidatura(usuarioId, entrevista.candidaturaId);
  }

  async garantirDonoSessao(usuarioId: string, sessaoId: string): Promise<void> {
    const sessao = await this.repo.buscarSessaoVoz(sessaoId, SISTEMA);
    if (!sessao) throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'sessão não encontrada');
    await this.garantirDonoEntrevista(usuarioId, sessao.entrevistaId);
  }

  async garantirDonoCandidatura(usuarioId: string, candidaturaId: string): Promise<void> {
    const candidato = await this.repo.buscarCandidatoPorUsuario(usuarioId);
    const candidatura = await this.repo.buscarCandidatura(candidaturaId, SISTEMA);
    if (!candidato || !candidatura || candidatura.candidatoId !== candidato.id) {
      throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'candidatura não encontrada');
    }
  }

  private async avancarExpirada(
    entrevista: EntrevistaRegistro,
    sessao: SessaoVozRegistro,
    roteiro: ItemRoteiro[],
    estado: EstadoVoz,
    agora: Date,
    pipeline: { etapas: { nome: string; duracaoMs: number }[]; totalMs: number },
  ) {
    const atual = roteiro[estado.indice];
    if (atual) {
      await this.gravarResposta(entrevista, atual, estado.rascunho ?? '', {
        expirou: true,
        parcial: true,
        tempoUsado: atual.tempoLimiteSegundos,
      });
    }
    const proxima = roteiro[estado.indice + 1];
    if (!proxima) {
      const fim = await this.concluir(entrevista, sessao, agora, pipeline, 'CONCLUIDA');
      return { ...fim, expirou: true, mensagem: 'O tempo acabou. Encerramos a entrevista por aqui.' };
    }
    const novo: EstadoVoz = {
      indice: estado.indice + 1,
      inicioPerguntaEm: agora.toISOString(),
      pausadoMs: 0,
      pausadoEm: null,
      followUpUsado: false,
      avisoEnviado: false,
      rascunho: null,
    };
    await this.salvarEstado(entrevista, novo, agora, novo.indice);
    return {
      acao: 'pergunta' as const,
      expirou: true,
      mensagem: 'O tempo desta pergunta acabou. Seguimos para a próxima.',
      enunciado: proxima.enunciado,
      segundosRestantes: proxima.tempoLimiteSegundos,
      aviso: false,
      etapas: pipeline.etapas,
      totalMs: pipeline.totalMs,
    };
  }

  private async concluir(
    entrevista: EntrevistaRegistro,
    sessao: SessaoVozRegistro,
    agora: Date,
    pipeline: { etapas: { nome: string; duracaoMs: number }[]; totalMs: number },
    status: 'CONCLUIDA',
  ) {
    await this.repo.atualizarSessaoVoz(
      sessao.id,
      { status: 'FINALIZADA', fimEm: agora, motivoFim: status, atualizadoEm: agora },
      SISTEMA,
    );
    await this.repo.atualizarEntrevista(entrevista.id, { status, ultimaInteracaoEm: agora, atualizadoEm: agora }, SISTEMA);
    const candidatura = await this.repo.buscarCandidatura(entrevista.candidaturaId, SISTEMA);
    if (candidatura?.status === 'ENTREVISTA_VOZ') {
      await this.candidaturas.aplicar(
        candidatura.id,
        { tipo: 'concluirEntrevista' },
        { autorId: null, motivo: 'entrevista de voz concluída' },
        SISTEMA,
      );
    }
    return {
      acao: 'concluida' as const,
      status,
      eliminada: false,
      etapas: pipeline.etapas,
      totalMs: pipeline.totalMs,
    };
  }

  private async abandonar(entrevista: EntrevistaRegistro, sessao: SessaoVozRegistro, agora: Date, motivo: string) {
    await this.repo.atualizarSessaoVoz(
      sessao.id,
      { status: 'ABANDONADA', fimEm: agora, motivoFim: motivo, atualizadoEm: agora },
      SISTEMA,
    );
    await this.repo.atualizarEntrevista(
      entrevista.id,
      { status: 'ABANDONADA', ultimaInteracaoEm: agora, atualizadoEm: agora },
      SISTEMA,
    );
    const candidatura = await this.repo.buscarCandidatura(entrevista.candidaturaId, SISTEMA);
    if (candidatura?.status === 'ENTREVISTA_VOZ') {
      await this.candidaturas.aplicar(
        candidatura.id,
        { tipo: 'abandonarEntrevista' },
        { autorId: null, motivo },
        SISTEMA,
      );
    }
  }

  private async gravarResposta(
    entrevista: EntrevistaRegistro,
    item: ItemRoteiro | undefined,
    texto: string,
    flags: { expirou: boolean; parcial: boolean; tempoUsado: number },
  ) {
    if (!item) return;
    const sessoes = await this.repo.listarSessoesEntrevista(entrevista.id, SISTEMA);
    const respostaId = randomUUID();
    await this.repo.criarResposta({
      id: respostaId,
      empresaId: entrevista.empresaId,
      entrevistaId: entrevista.id,
      etapaPerguntaId: item.etapaPerguntaId,
      tipo: 'VOZ_TEMPO_REAL',
      textoOriginal: texto || null,
      audioUrl: sessoes.find((sessao) => sessao.gravacaoKey)?.gravacaoKey ?? null,
      transcricao: texto || null,
      statusTranscricao: 'CONCLUIDA',
      confiancaTranscricao: 1,
      revisaoHumanaNecessaria: flags.expirou || flags.parcial,
      parcial: flags.parcial,
      expirou: flags.expirou,
      tempoUsado: flags.tempoUsado,
    });
    await this.repo.salvarAvaliacao(
      {
        id: randomUUID(),
        respostaId,
        avaliador: 'IA',
        nota: flags.expirou ? 0 : texto.trim().length >= 40 ? 8 : 5,
        criterios: { contaNaMedia: !flags.expirou, origem: 'voz' },
        justificativa: flags.expirou ? 'tempo esgotado' : 'resposta dentro do roteiro',
        modelo: 'mock-deterministico',
        versaoPrompt: 'voz-avaliacao-v1',
        criadoEm: this.relogio.agora(),
      },
      SISTEMA,
    );
  }

  private async salvarEstado(
    entrevista: EntrevistaRegistro,
    estado: EstadoVoz,
    agora: Date,
    perguntaAtual?: number,
    status?: EntrevistaRegistro['status'],
  ) {
    await this.repo.atualizarEntrevista(
      entrevista.id,
      {
        contexto: { ...(entrevista.contexto ?? {}), voz: estado },
        ultimaInteracaoEm: agora,
        atualizadoEm: agora,
        ...(perguntaAtual === undefined ? {} : { perguntaAtual }),
        ...(status ? { status } : {}),
      },
      SISTEMA,
    );
  }

  private async sessaoAtiva(sessaoId: string) {
    const sessao = await this.repo.buscarSessaoVoz(sessaoId, SISTEMA);
    if (!sessao || sessao.status !== 'ATIVA') throw new ErroAplicacao('SESSAO_INVALIDA', 409, 'sessão inativa');
    const entrevista = await this.exigirEntrevista(sessao.entrevistaId);
    return { sessao, entrevista };
  }

  private async exigirEntrevista(id: string): Promise<EntrevistaRegistro> {
    const entrevista = await this.repo.buscarEntrevista(id, SISTEMA);
    if (!entrevista) throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'entrevista não encontrada');
    return entrevista;
  }

  private async exigirGravacao(candidatoId: string) {
    const vigentes = consentimentosVigentes(await this.repo.listarConsentimentos(candidatoId));
    const gravacao = vigentes.find((item) => item.tipo === 'GRAVACAO_VOZ');
    if (!gravacao?.concedido) throw new ErroAplicacao('SEM_CONSENTIMENTO', 403, 'consentimento de gravação ausente');
  }

  private async etapaVoz(vagaId: string) {
    const processo = await this.repo.buscarProcessoPorVaga(vagaId, SISTEMA);
    if (!processo) throw new ErroAplicacao('ETAPA_AUSENTE', 404, 'processo sem etapa de voz');
    const etapas = await this.repo.listarEtapas(processo.id, SISTEMA);
    const etapa = etapas.find((item) => item.tipo === 'ENTREVISTA_VOZ');
    if (!etapa) throw new ErroAplicacao('ETAPA_AUSENTE', 404, 'processo sem etapa de voz');
    return etapa;
  }

  private async roteiro(entrevista: EntrevistaRegistro): Promise<ItemRoteiro[]> {
    const processo = await this.repo.buscarProcessoPorVaga(
      (await this.repo.buscarCandidatura(entrevista.candidaturaId, SISTEMA))?.vagaId ?? '',
      SISTEMA,
    );
    const padrao = processo?.tempoPadraoPorPergunta ?? 180;
    const vinculos = await this.repo.listarVinculosEtapa(entrevista.etapaId, SISTEMA);
    const itens: ItemRoteiro[] = [];
    for (const vinculo of [...vinculos].sort((a, b) => a.ordem - b.ordem)) {
      const pergunta = await this.repo.buscarPergunta(vinculo.perguntaId, SISTEMA);
      itens.push({
        etapaPerguntaId: vinculo.id,
        ordem: vinculo.ordem,
        enunciado: pergunta?.enunciado ?? '',
        tempoLimiteSegundos: vinculo.tempoLimiteSegundos ?? pergunta?.tempoLimiteSegundos ?? padrao,
      });
    }
    return itens;
  }

  private async janelaMs(entrevista: EntrevistaRegistro): Promise<number> {
    const candidatura = await this.repo.buscarCandidatura(entrevista.candidaturaId, SISTEMA);
    const processo = candidatura ? await this.repo.buscarProcessoPorVaga(candidatura.vagaId, SISTEMA) : null;
    return (processo?.janelaReconexaoSegundos ?? JANELA_RECONEXAO_MS_PADRAO / 1000) * 1000;
  }

  private estadoDe(entrevista: EntrevistaRegistro): EstadoVoz {
    return (
      entrevista.contexto?.voz ?? {
        indice: entrevista.perguntaAtual,
        inicioPerguntaEm: (entrevista.iniciadaEm ?? this.relogio.agora()).toISOString(),
        pausadoMs: 0,
        pausadoEm: null,
        followUpUsado: false,
        avisoEnviado: false,
        rascunho: null,
      }
    );
  }

  private restante(estado: EstadoVoz, roteiro: ItemRoteiro[], agora: Date): number {
    const atual = roteiro[estado.indice];
    if (!atual) return 0;
    return tempoRestanteSegundos(estado, agora, atual.tempoLimiteSegundos);
  }

  private tentativaConsumida(entrevista: EntrevistaRegistro): boolean {
    if (!entrevista.iniciadaEm) return false;
    return !['RECONECTANDO', 'EM_SESSAO', 'DISPONIVEL'].includes(entrevista.status);
  }

  private resumo(entrevista: EntrevistaRegistro) {
    return {
      id: entrevista.id,
      candidaturaId: entrevista.candidaturaId,
      status: entrevista.status,
      iniciadaEm: entrevista.iniciadaEm?.toISOString() ?? null,
      excecaoConcedida: entrevista.excecaoConcedida,
    };
  }

  private maxSessoes(): number {
    const valor = Number(process.env.VOZ_MAX_SESSOES ?? VOZ_MAX_SESSOES_SIMULTANEAS);
    return Number.isFinite(valor) && valor > 0 ? valor : VOZ_MAX_SESSOES_SIMULTANEAS;
  }

  private async alinhar(sessao: SessaoRequest, empresaId: string): Promise<SessaoRequest> {
    const ctx = ctxDe({ ...sessao, empresaId }, empresaId);
    const empresa = await this.repo.buscarEmpresaPorId(empresaId, ctx);
    const membro = await this.repo.buscarMembro(sessao.usuario.id, empresaId, ctx);
    const base = { ...sessao, empresaId, empresa, membro };
    return { ...base, ator: montarAtor(base) };
  }
}
