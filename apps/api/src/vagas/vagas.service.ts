import { randomUUID } from 'node:crypto';

import type {
  AtualizarVagaInput,
  CriarPerguntaInput,
  CriarVagaInput,
  SalvarProcessoInput,
  VincularPerguntaInput,
} from '@scv/contracts';
import {
  aceitaInscricoes,
  EFEITOS_EVENTO_VAGA,
  formatarInstanteBrasilia,
  interpretarPrazo,
  NUMERO_PERGUNTAS_PADRAO,
  POLITICA_RETRY_PADRAO,
  processoPublicavel,
  TEMPO_PADRAO_PERGUNTA_SEGUNDOS,
  tempoLimiteEfetivo,
  transicionarVaga,
  visivelNaListaPublica,
  type Acao,
  type ErroTransicaoVaga,
  type EstadoVaga,
  type TipoEventoVaga,
} from '@scv/domain';
import { sugerirPerguntas, type LlmProvider } from '@scv/llm';

import { AuditoriaService } from '../auditoria/auditoria.service';
import type { Relogio } from '../auth/auth.service';
import type { CandidaturaStateMachine, ResumoEfeitoVaga } from '../candidaturas/candidatura-state-machine';
import type { ConfiguracaoApp } from '../configuracao';
import { ErroAplicacao } from '../erros';
import type { FilaMatch } from '../fila/fila-match';
import type { FilaVagas } from '../fila/fila-vagas';
import type {
  ContextoTenant,
  EtapaRegistro,
  EventoVagaRegistro,
  PerguntaRegistro,
  ProcessoRegistro,
  Repositorio,
  VagaHabilidadeRegistro,
  VagaRegistro,
} from '../repositorio/tipos';
import { ctxDe, exigir, montarAtor, papelAuditoria, type SessaoRequest } from '../sessao';
import type { TriagemRetryService } from '../triagem/triagem-retry.service';

const MENSAGENS: Record<ErroTransicaoVaga, string> = {
  PRAZO_OBRIGATORIO: 'prazo de inscrições obrigatório para publicar',
  PRAZO_NO_PASSADO: 'o prazo precisa estar no futuro',
  PRAZO_NAO_POSTERIOR: 'o novo prazo precisa ser posterior ao atual',
  EMPRESA_NAO_VERIFICADA: 'empresa não verificada não publica vaga',
  MOTIVO_OBRIGATORIO: 'motivo obrigatório',
  VAGA_FECHADA: 'vaga fechada não reabre; duplique a vaga',
  TRANSICAO_INVALIDA: 'transição inválida',
};

const MOTIVO_EVENTO: Record<TipoEventoVaga, string> = {
  VagaPausada: 'vaga pausada',
  VagaRetomada: 'vaga retomada',
  VagaFechada: 'vaga fechada',
  AlertaPausaLonga: 'alerta de pausa longa',
};

export class VagasService {
  constructor(
    private readonly repo: Repositorio,
    private readonly auditoria: AuditoriaService,
    private readonly fila: FilaVagas,
    private readonly llm: LlmProvider,
    private readonly config: ConfiguracaoApp,
    private readonly relogio: Relogio,
    private readonly candidaturas: CandidaturaStateMachine,
    private readonly filaMatch: FilaMatch,
    private readonly retries: TriagemRetryService,
  ) {}

  listarCatalogo(): Promise<Array<{ id: string; nome: string; categoria: string }>> {
    return this.repo.listarCatalogoHabilidades();
  }

  async criar(sessao: SessaoRequest, empresaId: string, entrada: CriarVagaInput) {
    const { ctx } = await this.alinhar(sessao, empresaId, 'criar_vaga');
    this.validarFaixa(entrada.faixaSalarialMin, entrada.faixaSalarialMax);
    const agora = this.relogio.agora();
    const vaga = await this.repo.criarVaga(
      {
        id: randomUUID(),
        empresaId,
        titulo: entrada.titulo,
        descricao: entrada.descricao,
        senioridade: entrada.senioridade,
        modelo: entrada.modelo,
        localidade: entrada.localidade ?? null,
        tipoContrato: entrada.tipoContrato ?? null,
        faixaSalarialMin: entrada.faixaSalarialMin ?? null,
        faixaSalarialMax: entrada.faixaSalarialMax ?? null,
        beneficios: entrada.beneficios ?? [],
        posicoes: entrada.posicoes ?? 1,
        status: 'RASCUNHO',
        prazoInscricoes: entrada.prazoInscricoes ? this.prazo(entrada.prazoInscricoes) : null,
        inscricoesEncerradasEm: null,
        pausadaEm: null,
        statusAntesDaPausa: null,
        fechadaEm: null,
        motivoFechamento: null,
        alertaPausaEm: null,
        criadoEm: agora,
        atualizadoEm: agora,
      },
      ctx,
    );
    if (entrada.habilidades?.length) await this.gravarHabilidades(vaga.id, entrada.habilidades, ctx);
    return this.detalhe(vaga.id, ctx);
  }

  async atualizar(sessao: SessaoRequest, empresaId: string, vagaId: string, entrada: AtualizarVagaInput) {
    const { ctx } = await this.alinhar(sessao, empresaId, 'criar_vaga');
    const atual = await this.exigirVaga(vagaId, empresaId, ctx);
    if (atual.status !== 'RASCUNHO') throw new ErroAplicacao('TRANSICAO_INVALIDA', 409, 'só o rascunho pode ser editado');
    this.validarFaixa(entrada.faixaSalarialMin ?? atual.faixaSalarialMin, entrada.faixaSalarialMax ?? atual.faixaSalarialMax);
    await this.repo.atualizarVaga(
      vagaId,
      {
        titulo: entrada.titulo,
        descricao: entrada.descricao,
        senioridade: entrada.senioridade,
        modelo: entrada.modelo,
        localidade: entrada.localidade,
        tipoContrato: entrada.tipoContrato,
        faixaSalarialMin: entrada.faixaSalarialMin,
        faixaSalarialMax: entrada.faixaSalarialMax,
        beneficios: entrada.beneficios,
        posicoes: entrada.posicoes,
        prazoInscricoes: entrada.prazoInscricoes === undefined ? undefined : entrada.prazoInscricoes ? this.prazo(entrada.prazoInscricoes) : null,
        atualizadoEm: this.relogio.agora(),
      },
      ctx,
    );
    if (entrada.habilidades) await this.gravarHabilidades(vagaId, entrada.habilidades, ctx);
    return this.detalhe(vagaId, ctx);
  }

  async obter(sessao: SessaoRequest, empresaId: string, vagaId: string) {
    const { ctx } = await this.alinhar(sessao, empresaId, 'criar_vaga');
    await this.encerrarEmpresa(empresaId, ctx);
    return this.detalhe(vagaId, ctx);
  }

  async listar(sessao: SessaoRequest, empresaId: string) {
    const { ctx } = await this.alinhar(sessao, empresaId, 'criar_vaga');
    await this.encerrarEmpresa(empresaId, ctx);
    const vagas = await this.repo.listarVagasEmpresa(empresaId, ctx);
    return Promise.all(vagas.map((vaga) => this.detalhe(vaga.id, ctx)));
  }

  async salvarProcesso(sessao: SessaoRequest, empresaId: string, vagaId: string, entrada: SalvarProcessoInput) {
    const { ctx } = await this.alinhar(sessao, empresaId, 'criar_vaga');
    await this.exigirRascunho(vagaId, empresaId, ctx);
    const ordens = new Set<number>();
    for (const etapa of entrada.etapas) {
      if (ordens.has(etapa.ordem)) throw new ErroAplicacao('DADOS_INVALIDOS', 400, 'ordem de etapa repetida');
      ordens.add(etapa.ordem);
    }
    const existente = await this.repo.buscarProcessoPorVaga(vagaId, ctx);
    const processo = await this.repo.salvarProcesso(
      {
        id: existente?.id ?? randomUUID(),
        vagaId,
        empresaId,
        tempoPadraoPorPergunta: entrada.tempoPadraoPorPergunta ?? existente?.tempoPadraoPorPergunta ?? TEMPO_PADRAO_PERGUNTA_SEGUNDOS,
        politicaRetry: { ...POLITICA_RETRY_PADRAO, ...existente?.politicaRetry, ...entrada.politicaRetry },
        janelaReconexaoSegundos: entrada.janelaReconexaoSegundos ?? existente?.janelaReconexaoSegundos ?? 60,
      },
      ctx,
    );
    const atuais = await this.repo.listarEtapas(processo.id, ctx);
    const mantidas = new Set<string>();
    for (const etapa of entrada.etapas) {
      const atual = atuais.find((item) => item.ordem === etapa.ordem);
      const numero = etapa.numeroPerguntas ?? atual?.numeroPerguntas ?? NUMERO_PERGUNTAS_PADRAO;
      if (atual) {
        const vinculos = await this.repo.listarVinculosEtapa(atual.id, ctx);
        if (vinculos.length > numero) throw new ErroAplicacao('PERGUNTAS_EXCESSO', 409, 'há mais perguntas do que o novo limite');
      }
      const salva = await this.repo.salvarEtapa(
        {
          id: atual?.id ?? randomUUID(),
          processoId: processo.id,
          ordem: etapa.ordem,
          tipo: etapa.tipo,
          numeroPerguntas: numero,
        },
        ctx,
      );
      mantidas.add(salva.id);
    }
    for (const atual of atuais) {
      if (mantidas.has(atual.id)) continue;
      const vinculos = await this.repo.listarVinculosEtapa(atual.id, ctx);
      const pendentes = await this.repo.listarSugestoesEtapa(atual.id, ctx);
      if (vinculos.length > 0 || pendentes.length > 0) {
        throw new ErroAplicacao('ETAPA_COM_PERGUNTAS', 409, 'etapa com perguntas não pode ser removida');
      }
      await this.repo.removerEtapa(atual.id, ctx);
    }
    return this.detalhe(vagaId, ctx);
  }

  async listarPerguntas(sessao: SessaoRequest, empresaId: string) {
    const { ctx } = await this.alinhar(sessao, empresaId, 'criar_vaga');
    const perguntas = await this.repo.listarPerguntasEmpresa(empresaId, ctx);
    return perguntas.map((pergunta) => this.perguntaDto(pergunta));
  }

  async criarPerguntaBanco(sessao: SessaoRequest, empresaId: string, entrada: CriarPerguntaInput) {
    const { ctx } = await this.alinhar(sessao, empresaId, 'criar_vaga');
    const pergunta = await this.repo.criarPergunta(
      {
        id: randomUUID(),
        empresaId,
        enunciado: entrada.enunciado,
        rubrica: entrada.rubrica ?? {},
        origem: 'EMPRESA',
        statusSugestao: 'NAO_APLICA',
        versaoPrompt: null,
        etapaAlvoId: null,
        tempoLimiteSegundos: entrada.tempoLimiteSegundos ?? null,
      },
      ctx,
    );
    return this.perguntaDto(pergunta);
  }

  async adicionarPergunta(sessao: SessaoRequest, empresaId: string, vagaId: string, etapaId: string, entrada: VincularPerguntaInput) {
    const { ctx } = await this.alinhar(sessao, empresaId, 'criar_vaga');
    await this.exigirRascunho(vagaId, empresaId, ctx);
    const etapa = await this.exigirEtapaDaVaga(etapaId, vagaId, ctx);
    const vinculos = await this.repo.listarVinculosEtapa(etapa.id, ctx);
    if (vinculos.length >= etapa.numeroPerguntas) throw new ErroAplicacao('ETAPA_COMPLETA', 409, 'etapa já tem todas as perguntas');
    let perguntaId = entrada.perguntaId ?? null;
    if (perguntaId) {
      const existente = await this.repo.buscarPergunta(perguntaId, ctx);
      if (!existente || existente.empresaId !== empresaId) throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'pergunta não encontrada');
    } else {
      if (!entrada.enunciado) throw new ErroAplicacao('DADOS_INVALIDOS', 400, 'enunciado obrigatório');
      const criada = await this.repo.criarPergunta(
        {
          id: randomUUID(),
          empresaId,
          enunciado: entrada.enunciado,
          rubrica: entrada.rubrica ?? {},
          origem: 'EMPRESA',
          statusSugestao: 'APROVADA',
          versaoPrompt: null,
          etapaAlvoId: null,
          tempoLimiteSegundos: entrada.tempoLimiteSegundos ?? null,
        },
        ctx,
      );
      perguntaId = criada.id;
    }
    await this.repo.vincularPergunta(
      {
        id: randomUUID(),
        etapaId: etapa.id,
        perguntaId,
        ordem: vinculos.length + 1,
        peso: 1,
        tempoLimiteSegundos: entrada.tempoLimiteEtapaSegundos ?? null,
      },
      ctx,
    );
    return this.detalhe(vagaId, ctx);
  }

  async sugerir(sessao: SessaoRequest, empresaId: string, vagaId: string, etapaId: string) {
    const { ctx } = await this.alinhar(sessao, empresaId, 'criar_vaga');
    await this.exigirRascunho(vagaId, empresaId, ctx);
    await this.fila.enfileirarSugestao(etapaId);
    return this.gerarSugestoes(empresaId, vagaId, etapaId, ctx);
  }

  async gerarSugestoes(empresaId: string, vagaId: string, etapaId: string, ctx: ContextoTenant) {
    const vaga = await this.exigirVaga(vagaId, empresaId, ctx);
    const etapa = await this.exigirEtapaDaVaga(etapaId, vagaId, ctx);
    const processo = await this.repo.buscarProcessoPorVaga(vagaId, ctx);
    if (!processo) throw new ErroAplicacao('PROCESSO_INCOMPLETO', 409, 'processo seletivo ausente');
    const vinculos = await this.repo.listarVinculosEtapa(etapa.id, ctx);
    const pendentes = await this.repo.listarSugestoesEtapa(etapa.id, ctx);
    const faltantes = etapa.numeroPerguntas - vinculos.length - pendentes.length;
    if (faltantes <= 0) return { sugestoes: pendentes.map((item) => this.perguntaDto(item)) };
    const habilidades = await this.repo.listarHabilidadesVaga(vagaId, ctx);
    const existentes = await Promise.all(vinculos.map((vinculo) => this.repo.buscarPergunta(vinculo.perguntaId, ctx)));
    const geradas = await sugerirPerguntas(this.llm, {
      titulo: vaga.titulo,
      descricao: vaga.descricao,
      senioridade: vaga.senioridade,
      modelo: vaga.modelo,
      habilidades: habilidades.map((item) => item.nome),
      existentes: existentes.flatMap((item) => (item ? [item.enunciado] : [])),
      faltantes,
      tipoEtapa: etapa.tipo,
    });
    const criadas: PerguntaRegistro[] = [];
    for (const sugestao of geradas.perguntas) {
      criadas.push(
        await this.repo.criarPergunta(
          {
            id: randomUUID(),
            empresaId,
            enunciado: sugestao.enunciado,
            rubrica: sugestao.rubrica,
            origem: 'IA_SUGERIDA',
            statusSugestao: 'PENDENTE',
            versaoPrompt: geradas.versaoPrompt,
            etapaAlvoId: etapa.id,
            tempoLimiteSegundos: sugestao.tempoLimiteSegundos,
          },
          ctx,
        ),
      );
    }
    return { sugestoes: [...pendentes, ...criadas].map((item) => this.perguntaDto(item)) };
  }

  async aceitarSugestao(
    sessao: SessaoRequest,
    empresaId: string,
    perguntaId: string,
    entrada: { enunciado?: string; rubrica?: Record<string, unknown>; tempoLimiteSegundos?: number | null },
  ) {
    const { ctx } = await this.alinhar(sessao, empresaId, 'criar_vaga');
    const pergunta = await this.exigirPergunta(perguntaId, empresaId, ctx);
    if (pergunta.statusSugestao !== 'PENDENTE' || !pergunta.etapaAlvoId) {
      throw new ErroAplicacao('TRANSICAO_INVALIDA', 409, 'sugestão não está pendente');
    }
    const etapa = await this.repo.buscarEtapa(pergunta.etapaAlvoId, ctx);
    if (!etapa) throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'etapa não encontrada');
    const processo = await this.processoDaEtapa(etapa, ctx);
    await this.exigirRascunho(processo.vagaId, empresaId, ctx);
    const vinculos = await this.repo.listarVinculosEtapa(etapa.id, ctx);
    if (vinculos.length >= etapa.numeroPerguntas) throw new ErroAplicacao('ETAPA_COMPLETA', 409, 'etapa já tem todas as perguntas');
    await this.repo.atualizarPergunta(
      perguntaId,
      {
        enunciado: entrada.enunciado,
        rubrica: entrada.rubrica,
        tempoLimiteSegundos: entrada.tempoLimiteSegundos,
        statusSugestao: 'APROVADA',
        etapaAlvoId: null,
      },
      ctx,
    );
    await this.repo.vincularPergunta(
      {
        id: randomUUID(),
        etapaId: etapa.id,
        perguntaId,
        ordem: vinculos.length + 1,
        peso: 1,
        tempoLimiteSegundos: null,
      },
      ctx,
    );
    return this.detalhe(processo.vagaId, ctx);
  }

  async descartarSugestao(sessao: SessaoRequest, empresaId: string, perguntaId: string) {
    const { ctx } = await this.alinhar(sessao, empresaId, 'criar_vaga');
    const pergunta = await this.exigirPergunta(perguntaId, empresaId, ctx);
    if (pergunta.statusSugestao !== 'PENDENTE') throw new ErroAplicacao('TRANSICAO_INVALIDA', 409, 'sugestão não está pendente');
    await this.repo.atualizarPergunta(perguntaId, { statusSugestao: 'DESCARTADA', etapaAlvoId: null }, ctx);
    return { id: perguntaId, statusSugestao: 'DESCARTADA' as const };
  }

  async revisarPergunta(
    sessao: SessaoRequest,
    empresaId: string,
    perguntaId: string,
    entrada: { enunciado?: string; rubrica?: Record<string, unknown>; tempoLimiteSegundos?: number | null },
  ) {
    const { ctx } = await this.alinhar(sessao, empresaId, 'criar_vaga');
    await this.exigirPergunta(perguntaId, empresaId, ctx);
    const atualizada = await this.repo.atualizarPergunta(perguntaId, entrada, ctx);
    if (!atualizada) throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'pergunta não encontrada');
    return this.perguntaDto(atualizada);
  }

  async publicar(sessao: SessaoRequest, empresaId: string, vagaId: string) {
    const { ctx, alinhada } = await this.alinhar(sessao, empresaId, 'publicar_vaga');
    const vaga = await this.exigirVaga(vagaId, empresaId, ctx);
    if (!vaga.prazoInscricoes) throw new ErroAplicacao('PRAZO_OBRIGATORIO', 400, MENSAGENS.PRAZO_OBRIGATORIO);
    const etapas = await this.contagemEtapas(vagaId, ctx);
    if (etapas === null) throw new ErroAplicacao('PROCESSO_INCOMPLETO', 409, 'processo seletivo ausente');
    if (!processoPublicavel(etapas)) throw new ErroAplicacao('PERGUNTAS_INCOMPLETAS', 409, 'aprove todas as perguntas da etapa');
    const agora = this.relogio.agora();
    const resultado = transicionarVaga(
      this.estado(vaga),
      { tipo: 'publicar', prazo: vaga.prazoInscricoes, empresaVerificada: alinhada.empresa?.statusVerificacao === 'VERIFICADA' },
      agora,
    );
    const salva = await this.aplicar(vagaId, resultado, ctx);
    await this.auditar(alinhada, empresaId, vagaId, 'VAGA_PUBLICADA', null, ctx);
    await this.fila.agendarEncerramento(vagaId, salva.prazoInscricoes ?? agora);
    // O job de embedding enfileira o match vaga → candidatos ao terminar.
    await this.filaMatch.enfileirarEmbeddingVaga(vagaId);
    return this.detalhe(vagaId, ctx);
  }

  async prorrogar(sessao: SessaoRequest, empresaId: string, vagaId: string, prazoTexto: string) {
    const { ctx, alinhada } = await this.alinhar(sessao, empresaId, 'pausar_vaga');
    const vaga = await this.exigirVaga(vagaId, empresaId, ctx);
    const prazo = this.prazo(prazoTexto);
    const resultado = transicionarVaga(this.estado(vaga), { tipo: 'prorrogar', prazo }, this.relogio.agora());
    const salva = await this.aplicar(vagaId, resultado, ctx);
    await this.auditar(alinhada, empresaId, vagaId, 'VAGA_PRORROGADA', null, ctx);
    if (salva.prazoInscricoes) await this.fila.agendarEncerramento(vagaId, salva.prazoInscricoes);
    if (vaga.status !== 'PUBLICADA' && salva.status === 'PUBLICADA') await this.filaMatch.enfileirarEmbeddingVaga(vagaId);
    return this.detalhe(vagaId, ctx);
  }

  async pausar(sessao: SessaoRequest, empresaId: string, vagaId: string) {
    const { ctx, alinhada } = await this.alinhar(sessao, empresaId, 'pausar_vaga');
    const vaga = await this.exigirVaga(vagaId, empresaId, ctx);
    const resultado = transicionarVaga(this.estado(vaga), { tipo: 'pausar' }, this.relogio.agora());
    await this.aplicar(vagaId, resultado, ctx);
    if (resultado.ok && resultado.evento) await this.emitir(vaga, resultado.evento, ctx);
    await this.auditar(alinhada, empresaId, vagaId, 'VAGA_PAUSADA', null, ctx);
    return this.detalhe(vagaId, ctx);
  }

  async retomar(sessao: SessaoRequest, empresaId: string, vagaId: string) {
    const { ctx, alinhada } = await this.alinhar(sessao, empresaId, 'pausar_vaga');
    const vaga = await this.exigirVaga(vagaId, empresaId, ctx);
    const resultado = transicionarVaga(this.estado(vaga), { tipo: 'retomar' }, this.relogio.agora());
    const salva = await this.aplicar(vagaId, resultado, ctx);
    if (resultado.ok && resultado.evento) await this.emitir(vaga, resultado.evento, ctx);
    await this.auditar(alinhada, empresaId, vagaId, 'VAGA_RETOMADA', null, ctx);
    if (salva.status === 'PUBLICADA' && salva.prazoInscricoes) {
      await this.fila.agendarEncerramento(vagaId, salva.prazoInscricoes);
      await this.filaMatch.enfileirarEmbeddingVaga(vagaId);
    }
    if (salva.status === 'INSCRICOES_ENCERRADAS') await this.fila.cancelarEncerramento(vagaId);
    return this.detalhe(vagaId, ctx);
  }

  async fechar(sessao: SessaoRequest, empresaId: string, vagaId: string, motivo: string) {
    const { ctx, alinhada } = await this.alinhar(sessao, empresaId, 'pausar_vaga');
    const vaga = await this.exigirVaga(vagaId, empresaId, ctx);
    const resultado = transicionarVaga(this.estado(vaga), { tipo: 'fechar', motivo }, this.relogio.agora());
    await this.aplicar(vagaId, resultado, ctx);
    if (resultado.ok && resultado.evento) await this.emitir(vaga, resultado.evento, ctx, motivo.trim());
    await this.fila.cancelarEncerramento(vagaId);
    await this.auditar(alinhada, empresaId, vagaId, 'VAGA_FECHADA', motivo.trim(), ctx);
    return this.detalhe(vagaId, ctx);
  }

  async duplicar(sessao: SessaoRequest, empresaId: string, vagaId: string) {
    const { ctx, alinhada } = await this.alinhar(sessao, empresaId, 'criar_vaga');
    const origem = await this.exigirVaga(vagaId, empresaId, ctx);
    const agora = this.relogio.agora();
    const copia = await this.repo.criarVaga(
      {
        ...origem,
        id: randomUUID(),
        titulo: `${origem.titulo.slice(0, 150)} (cópia)`,
        status: 'RASCUNHO',
        prazoInscricoes: null,
        inscricoesEncerradasEm: null,
        pausadaEm: null,
        statusAntesDaPausa: null,
        fechadaEm: null,
        motivoFechamento: null,
        alertaPausaEm: null,
        criadoEm: agora,
        atualizadoEm: agora,
      },
      ctx,
    );
    const habilidades = await this.repo.listarHabilidadesVaga(vagaId, ctx);
    if (habilidades.length) {
      await this.repo.substituirHabilidades(
        copia.id,
        habilidades.map((item) => ({ ...item, vagaId: copia.id })),
        ctx,
      );
    }
    const processo = await this.repo.buscarProcessoPorVaga(vagaId, ctx);
    if (processo) {
      const novoProcesso = await this.repo.salvarProcesso({ ...processo, id: randomUUID(), vagaId: copia.id }, ctx);
      const etapas = await this.repo.listarEtapas(processo.id, ctx);
      for (const etapa of etapas) {
        const nova = await this.repo.salvarEtapa({ ...etapa, id: randomUUID(), processoId: novoProcesso.id }, ctx);
        const vinculos = await this.repo.listarVinculosEtapa(etapa.id, ctx);
        for (const vinculo of vinculos) {
          await this.repo.vincularPergunta({ ...vinculo, id: randomUUID(), etapaId: nova.id }, ctx);
        }
      }
    }
    await this.auditar(alinhada, empresaId, copia.id, 'VAGA_DUPLICADA', origem.id, ctx);
    return this.detalhe(copia.id, ctx);
  }

  async listarPublicas(query: { habilidade?: string; senioridade?: string; modelo?: string; localidade?: string }) {
    await this.reconciliar();
    const agora = this.relogio.agora();
    const vagas = await this.repo.listarVagasPublicas({ ...query, agora });
    return Promise.all(vagas.map((vaga) => this.publico(vaga)));
  }

  async obterPublica(vagaId: string) {
    await this.encerrarSePreciso(vagaId);
    const vaga = await this.repo.buscarVaga(vagaId, { sistema: true });
    if (!vaga || !visivelNaListaPublica(vaga, this.relogio.agora())) {
      throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'vaga não encontrada');
    }
    return this.publico(vaga);
  }

  async verificarInscricao(sessao: SessaoRequest, vagaId: string) {
    exigir(sessao, 'candidatar');
    await this.encerrarSePreciso(vagaId);
    const vaga = await this.repo.buscarVaga(vagaId, { sistema: true });
    if (!vaga || !aceitaInscricoes(vaga, this.relogio.agora())) {
      throw new ErroAplicacao('INSCRICOES_INDISPONIVEIS', 409, 'inscrições não disponíveis');
    }
    return { aceita: true as const };
  }

  async reconciliar() {
    const ctx: ContextoTenant = { sistema: true };
    const agora = this.relogio.agora();
    const vencidas = await this.repo.listarPublicadasVencidas(agora, ctx);
    for (const vaga of vencidas) await this.aplicarExpiracao(vaga, ctx);
    const limite = new Date(agora.getTime() - this.config.pausaMaxDias * 24 * 60 * 60 * 1000);
    const pausas = await this.repo.listarPausasParaAlerta(limite, ctx);
    for (const vaga of pausas) await this.alertar(vaga, ctx);
    return { encerradas: vencidas.length, alertas: pausas.length };
  }

  async encerrarJob(vagaId: string) {
    const encerrou = await this.encerrarSePreciso(vagaId);
    return { encerrada: encerrou };
  }

  async aplicarEvento(eventoId: string) {
    const ctx: ContextoTenant = { sistema: true };
    const evento = await this.repo.buscarEventoVaga(eventoId, ctx);
    if (!evento) throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'evento não encontrado');
    let candidaturas: ResumoEfeitoVaga = { aplicadas: 0, ignoradas: 0 };
    if (!evento.consumidoEm) {
      // Reprocessar após falha parcial é seguro: candidaturas já movidas são ignoradas.
      candidaturas = await this.aplicarEfeitosCandidatura(evento);
      await this.repo.marcarEventoConsumido(eventoId, this.relogio.agora(), ctx);
    }
    return { id: evento.id, tipo: evento.tipo, payload: evento.payload, consumido: true, candidaturas };
  }

  /** Candidaturas não têm bypass de sistema no RLS: aplica no contexto da empresa dona da vaga. */
  private async aplicarEfeitosCandidatura(evento: EventoVagaRegistro): Promise<ResumoEfeitoVaga> {
    const resumo: ResumoEfeitoVaga = { aplicadas: 0, ignoradas: 0 };
    if (!Object.hasOwn(EFEITOS_EVENTO_VAGA, evento.tipo)) return resumo;
    const tipo = evento.tipo as TipoEventoVaga;
    const detalhe = typeof evento.payload.motivo === 'string' && evento.payload.motivo ? `: ${evento.payload.motivo}` : '';
    const autoria = { autorId: null, motivo: `${MOTIVO_EVENTO[tipo]}${detalhe}` };
    const ctx: ContextoTenant = { empresaId: evento.empresaId };
    for (const efeito of EFEITOS_EVENTO_VAGA[tipo]) {
      if (efeito === 'SUSPENDER_RETRIES' || efeito === 'REAGENDAR_RETRIES' || efeito === 'CANCELAR_RETRIES') {
        await this.retries.consumirEfeito(efeito, evento.vagaId, evento.empresaId);
        continue;
      }
      const parcial = await this.candidaturas.aplicarEfeitoVaga(evento.vagaId, efeito, autoria, ctx);
      resumo.aplicadas += parcial.aplicadas;
      resumo.ignoradas += parcial.ignoradas;
    }
    return resumo;
  }

  private async alertar(vaga: VagaRegistro, ctx: ContextoTenant): Promise<void> {
    await this.emitir(vaga, 'AlertaPausaLonga', ctx);
    await this.repo.atualizarVaga(vaga.id, { alertaPausaEm: this.relogio.agora() }, ctx);
  }

  private async encerrarEmpresa(empresaId: string, ctx: ContextoTenant): Promise<void> {
    const agora = this.relogio.agora();
    const vencidas = (await this.repo.listarPublicadasVencidas(agora, ctx)).filter((vaga) => vaga.empresaId === empresaId);
    for (const vaga of vencidas) await this.aplicarExpiracao(vaga, ctx);
  }

  private async encerrarSePreciso(vagaId: string): Promise<boolean> {
    const ctx: ContextoTenant = { sistema: true };
    const vaga = await this.repo.buscarVaga(vagaId, ctx);
    if (!vaga) return false;
    const agora = this.relogio.agora();
    if (vaga.status !== 'PUBLICADA' || !vaga.prazoInscricoes || vaga.prazoInscricoes.getTime() > agora.getTime()) return false;
    await this.aplicarExpiracao(vaga, ctx);
    return true;
  }

  private async aplicarExpiracao(vaga: VagaRegistro, ctx: ContextoTenant): Promise<void> {
    const resultado = transicionarVaga(this.estado(vaga), { tipo: 'expirar' }, this.relogio.agora());
    if (!resultado.ok) return;
    await this.repo.atualizarVaga(vaga.id, { ...this.patchEstado(resultado.estado), atualizadoEm: this.relogio.agora() }, ctx);
    await this.candidaturas.expirarConvites(vaga.id, { empresaId: vaga.empresaId });
    for (const sugestao of await this.repo.listarSugestoesVaga(vaga.id, { empresaId: vaga.empresaId })) {
      if (sugestao.status === 'CONVIDADA') await this.repo.atualizarStatusSugestao(sugestao.id, 'EXPIRADA', { empresaId: vaga.empresaId });
    }
    await this.fila.cancelarEncerramento(vaga.id);
  }

  private async aplicar(vagaId: string, resultado: ReturnType<typeof transicionarVaga>, ctx: ContextoTenant): Promise<VagaRegistro> {
    if (!resultado.ok) {
      const status = resultado.codigo === 'EMPRESA_NAO_VERIFICADA' ? 403 : resultado.codigo === 'TRANSICAO_INVALIDA' || resultado.codigo === 'VAGA_FECHADA' ? 409 : 400;
      throw new ErroAplicacao(resultado.codigo, status, MENSAGENS[resultado.codigo]);
    }
    const salva = await this.repo.atualizarVaga(vagaId, { ...this.patchEstado(resultado.estado), atualizadoEm: this.relogio.agora() }, ctx);
    if (!salva) throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'vaga não encontrada');
    if (resultado.estado.status === 'FECHADA') await this.expirarConvitesDaVaga(salva);
    return salva;
  }

  private async expirarConvitesDaVaga(vaga: VagaRegistro): Promise<void> {
    await this.candidaturas.expirarConvites(vaga.id, { empresaId: vaga.empresaId });
    for (const sugestao of await this.repo.listarSugestoesVaga(vaga.id, { empresaId: vaga.empresaId })) {
      if (sugestao.status === 'CONVIDADA') await this.repo.atualizarStatusSugestao(sugestao.id, 'EXPIRADA', { empresaId: vaga.empresaId });
    }
  }

  private async emitir(vaga: VagaRegistro, tipo: TipoEventoVaga, ctx: ContextoTenant, motivo?: string): Promise<EventoVagaRegistro> {
    const agora = this.relogio.agora();
    const evento = await this.repo.registrarEventoVaga(
      {
        id: randomUUID(),
        empresaId: vaga.empresaId,
        vagaId: vaga.id,
        tipo,
        payload: {
          tipo,
          vagaId: vaga.id,
          empresaId: vaga.empresaId,
          ocorridoEm: agora.toISOString(),
          motivo: motivo ?? null,
          efeitos: [...EFEITOS_EVENTO_VAGA[tipo]],
        },
        criadoEm: agora,
        consumidoEm: null,
      },
      ctx,
    );
    await this.fila.enfileirarEfeitos(evento.id);
    return evento;
  }

  private async detalhe(vagaId: string, ctx: ContextoTenant) {
    const vaga = await this.repo.buscarVaga(vagaId, ctx);
    if (!vaga) throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'vaga não encontrada');
    const agora = this.relogio.agora();
    const habilidades = await this.repo.listarHabilidadesVaga(vagaId, ctx);
    const processo = await this.repo.buscarProcessoPorVaga(vagaId, ctx);
    const eventos = await this.repo.listarEventosVaga(vagaId, ctx);
    return {
      ...this.base(vaga, agora),
      inscricoesEncerradasEm: iso(vaga.inscricoesEncerradasEm),
      pausadaEm: iso(vaga.pausadaEm),
      fechadaEm: iso(vaga.fechadaEm),
      motivoFechamento: vaga.motivoFechamento,
      aceitaInscricoes: aceitaInscricoes(vaga, agora),
      habilidades: habilidades.map(this.habilidadeDto),
      eventos: eventos.map((evento) => ({
        id: evento.id,
        tipo: evento.tipo,
        efeitos: evento.payload.efeitos ?? [],
        ocorridoEm: iso(evento.criadoEm),
      })),
      processo: processo ? await this.processoDto(processo, ctx) : null,
    };
  }

  private async publico(vaga: VagaRegistro) {
    const habilidades = await this.repo.listarHabilidadesVaga(vaga.id, { leituraPublica: true });
    const agora = this.relogio.agora();
    return {
      id: vaga.id,
      titulo: vaga.titulo,
      descricao: vaga.descricao,
      senioridade: vaga.senioridade,
      modelo: vaga.modelo,
      localidade: vaga.localidade,
      tipoContrato: vaga.tipoContrato,
      faixaSalarialMin: vaga.faixaSalarialMin,
      faixaSalarialMax: vaga.faixaSalarialMax,
      beneficios: vaga.beneficios,
      posicoes: vaga.posicoes,
      prazoInscricoes: iso(vaga.prazoInscricoes),
      prazoInscricoesBrasilia: vaga.prazoInscricoes ? formatarInstanteBrasilia(vaga.prazoInscricoes) : null,
      habilidades: habilidades.map((item) => ({ nome: item.nome, nivelMinimo: item.nivelMinimo, obrigatoria: item.obrigatoria })),
      aceitaInscricoes: aceitaInscricoes(vaga, agora),
    };
  }

  private async processoDto(processo: ProcessoRegistro, ctx: ContextoTenant) {
    const etapas = await this.repo.listarEtapas(processo.id, ctx);
    return {
      id: processo.id,
      tempoPadraoPorPergunta: processo.tempoPadraoPorPergunta,
      politicaRetry: processo.politicaRetry,
      janelaReconexaoSegundos: processo.janelaReconexaoSegundos,
      etapas: await Promise.all(etapas.map((etapa) => this.etapaDto(etapa, processo, ctx))),
    };
  }

  private async etapaDto(etapa: EtapaRegistro, processo: ProcessoRegistro, ctx: ContextoTenant) {
    const vinculos = await this.repo.listarVinculosEtapa(etapa.id, ctx);
    const sugestoes = await this.repo.listarSugestoesEtapa(etapa.id, ctx);
    const perguntas = [];
    for (const vinculo of vinculos) {
      const pergunta = await this.repo.buscarPergunta(vinculo.perguntaId, ctx);
      if (!pergunta) continue;
      perguntas.push({
        id: vinculo.id,
        perguntaId: pergunta.id,
        ordem: vinculo.ordem,
        enunciado: pergunta.enunciado,
        origem: pergunta.origem,
        rubrica: pergunta.rubrica,
        tempoLimiteSegundos: vinculo.tempoLimiteSegundos,
        tempoPerguntaSegundos: pergunta.tempoLimiteSegundos,
        tempoLimiteEfetivoSegundos: tempoLimiteEfetivo({
          etapaPerguntaSegundos: vinculo.tempoLimiteSegundos,
          perguntaSegundos: pergunta.tempoLimiteSegundos,
          processoSegundos: processo.tempoPadraoPorPergunta,
        }),
      });
    }
    return {
      id: etapa.id,
      ordem: etapa.ordem,
      tipo: etapa.tipo,
      numeroPerguntas: etapa.numeroPerguntas,
      perguntas,
      sugestoes: sugestoes.map((item) => this.perguntaDto(item)),
    };
  }

  private async contagemEtapas(vagaId: string, ctx: ContextoTenant) {
    const processo = await this.repo.buscarProcessoPorVaga(vagaId, ctx);
    if (!processo) return null;
    const etapas = await this.repo.listarEtapas(processo.id, ctx);
    const contagem = [];
    for (const etapa of etapas) {
      const aprovadas = (await this.repo.listarVinculosEtapa(etapa.id, ctx)).length;
      const pendentes = (await this.repo.listarSugestoesEtapa(etapa.id, ctx)).length;
      contagem.push({ numeroPerguntas: etapa.numeroPerguntas, aprovadas, pendentes });
    }
    return contagem;
  }

  private base(vaga: VagaRegistro, agora: Date) {
    return {
      id: vaga.id,
      empresaId: vaga.empresaId,
      titulo: vaga.titulo,
      descricao: vaga.descricao,
      senioridade: vaga.senioridade,
      modelo: vaga.modelo,
      localidade: vaga.localidade,
      tipoContrato: vaga.tipoContrato,
      faixaSalarialMin: vaga.faixaSalarialMin,
      faixaSalarialMax: vaga.faixaSalarialMax,
      beneficios: vaga.beneficios,
      posicoes: vaga.posicoes,
      status: vaga.status,
      prazoInscricoes: iso(vaga.prazoInscricoes),
      prazoInscricoesBrasilia: vaga.prazoInscricoes ? formatarInstanteBrasilia(vaga.prazoInscricoes) : null,
      aceitaInscricoes: aceitaInscricoes(vaga, agora),
    };
  }

  private habilidadeDto(item: VagaHabilidadeRegistro) {
    return {
      habilidadeId: item.habilidadeId,
      nome: item.nome,
      nivelMinimo: item.nivelMinimo,
      peso: item.peso,
      obrigatoria: item.obrigatoria,
    };
  }

  private perguntaDto(pergunta: PerguntaRegistro) {
    return {
      id: pergunta.id,
      enunciado: pergunta.enunciado,
      rubrica: pergunta.rubrica,
      origem: pergunta.origem,
      statusSugestao: pergunta.statusSugestao,
      versaoPrompt: pergunta.versaoPrompt,
      tempoLimiteSegundos: pergunta.tempoLimiteSegundos,
      etapaAlvoId: pergunta.etapaAlvoId,
    };
  }

  private async gravarHabilidades(
    vagaId: string,
    habilidades: NonNullable<CriarVagaInput['habilidades']>,
    ctx: ContextoTenant,
  ): Promise<void> {
    const itens: VagaHabilidadeRegistro[] = [];
    for (const item of habilidades) {
      const habilidade = item.habilidadeId
        ? await this.repo.buscarHabilidade(item.habilidadeId)
        : item.nome
          ? await this.repo.garantirHabilidade(item.nome)
          : null;
      if (!habilidade) throw new ErroAplicacao('DADOS_INVALIDOS', 400, 'habilidade inválida');
      itens.push({
        vagaId,
        habilidadeId: habilidade.id,
        nome: habilidade.nome,
        nivelMinimo: item.nivelMinimo,
        peso: item.peso,
        obrigatoria: item.obrigatoria ?? false,
      });
    }
    await this.repo.substituirHabilidades(vagaId, itens, ctx);
  }

  private async alinhar(sessao: SessaoRequest, empresaId: string, acao: Acao) {
    const previa = ctxDe({ ...sessao, empresaId }, empresaId);
    const empresa = await this.repo.buscarEmpresaPorId(empresaId, previa);
    const membro = await this.repo.buscarMembro(sessao.usuario.id, empresaId, previa);
    const base = { ...sessao, empresaId, empresa, membro };
    const alinhada: SessaoRequest = { ...base, ator: montarAtor(base) };
    exigir(alinhada, acao);
    return { alinhada, ctx: ctxDe(alinhada, empresaId) };
  }

  private async exigirVaga(vagaId: string, empresaId: string, ctx: ContextoTenant): Promise<VagaRegistro> {
    const vaga = await this.repo.buscarVaga(vagaId, ctx);
    if (!vaga || vaga.empresaId !== empresaId) throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'vaga não encontrada');
    return vaga;
  }

  private async exigirRascunho(vagaId: string, empresaId: string, ctx: ContextoTenant): Promise<VagaRegistro> {
    const vaga = await this.exigirVaga(vagaId, empresaId, ctx);
    if (vaga.status !== 'RASCUNHO') throw new ErroAplicacao('TRANSICAO_INVALIDA', 409, 'só o rascunho pode ser editado');
    return vaga;
  }

  private async exigirEtapaDaVaga(etapaId: string, vagaId: string, ctx: ContextoTenant): Promise<EtapaRegistro> {
    const etapa = await this.repo.buscarEtapa(etapaId, ctx);
    if (!etapa) throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'etapa não encontrada');
    const processo = await this.processoDaEtapa(etapa, ctx);
    if (processo.vagaId !== vagaId) throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'etapa não encontrada');
    return etapa;
  }

  private async processoDaEtapa(etapa: EtapaRegistro, ctx: ContextoTenant): Promise<ProcessoRegistro> {
    const processo = await this.repo.buscarProcessoPorId(etapa.processoId, ctx);
    if (!processo) throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'processo não encontrado');
    return processo;
  }

  async sugerirJob(etapaId: string) {
    const ctx: ContextoTenant = { sistema: true };
    const etapa = await this.repo.buscarEtapa(etapaId, ctx);
    if (!etapa) throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'etapa não encontrada');
    const processo = await this.processoDaEtapa(etapa, ctx);
    return this.gerarSugestoes(processo.empresaId, processo.vagaId, etapaId, ctx);
  }

  private async exigirPergunta(id: string, empresaId: string, ctx: ContextoTenant): Promise<PerguntaRegistro> {
    const pergunta = await this.repo.buscarPergunta(id, ctx);
    if (!pergunta || pergunta.empresaId !== empresaId) throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'pergunta não encontrada');
    return pergunta;
  }

  private async auditar(
    sessao: SessaoRequest,
    empresaId: string,
    vagaId: string,
    acao: string,
    motivo: string | null,
    ctx: ContextoTenant,
  ): Promise<void> {
    await this.auditoria.registrar(
      {
        usuarioId: sessao.usuario.id,
        empresaId,
        papel: papelAuditoria(sessao),
        acao,
        recursoTipo: 'VAGA',
        recursoId: vagaId,
        motivo,
      },
      ctx,
    );
  }

  private estado(vaga: VagaRegistro): EstadoVaga {
    return {
      status: vaga.status,
      prazoInscricoes: vaga.prazoInscricoes,
      statusAntesDaPausa: vaga.statusAntesDaPausa,
      inscricoesEncerradasEm: vaga.inscricoesEncerradasEm,
      pausadaEm: vaga.pausadaEm,
      fechadaEm: vaga.fechadaEm,
      motivoFechamento: vaga.motivoFechamento,
      alertaPausaEm: vaga.alertaPausaEm,
    };
  }

  private patchEstado(estado: EstadoVaga): Partial<VagaRegistro> {
    return { ...estado };
  }

  private prazo(entrada: string): Date {
    const data = interpretarPrazo(entrada);
    if (!data) throw new ErroAplicacao('PRAZO_INVALIDO', 400, 'prazo inválido');
    return data;
  }

  private validarFaixa(min?: number | null, max?: number | null): void {
    if (min != null && max != null && min > max) throw new ErroAplicacao('DADOS_INVALIDOS', 400, 'faixa salarial inválida');
  }
}

function iso(data: Date | null): string | null {
  return data ? data.toISOString() : null;
}
