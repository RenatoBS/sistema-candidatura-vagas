import { randomUUID } from 'node:crypto';

import { Prisma, PrismaClient } from '@prisma/client';
import { EFEITOS_EVENTO_VAGA, POLITICA_RETRY_PADRAO, type PoliticaRetry } from '@scv/domain';

import { escopoTenant } from './escopo';
import type { ContextoTenant } from './tipos';
import type {
  EtapaPerguntaRegistro,
  EtapaRegistro,
  EventoVagaRegistro,
  FiltroVagaPublica,
  HabilidadeCatalogo,
  PerguntaRegistro,
  ProcessoRegistro,
  SenioridadeVaga,
  StatusSugestao,
  TipoEtapa,
  VagaHabilidadeRegistro,
  VagaRegistro,
} from './vagas-tipos';

type Tx = Prisma.TransactionClient;

function definido<T extends Record<string, unknown>>(obj: T): { [K in keyof T]?: T[K] } {
  return Object.fromEntries(Object.entries(obj).filter(([, valor]) => valor !== undefined)) as { [K in keyof T]?: T[K] };
}

function politica(valor: Prisma.JsonValue): PoliticaRetry {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return { ...POLITICA_RETRY_PADRAO };
  return { ...POLITICA_RETRY_PADRAO, ...(valor as Partial<PoliticaRetry>) };
}

function rubrica(valor: Prisma.JsonValue): Record<string, unknown> {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return {};
  return valor as Record<string, unknown>;
}

function vagaDe(vaga: {
  id: string;
  empresaId: string;
  titulo: string;
  descricao: string;
  senioridade: VagaRegistro['senioridade'];
  modelo: VagaRegistro['modelo'];
  localidade: string | null;
  tipoContrato: VagaRegistro['tipoContrato'];
  faixaSalarialMin: number | null;
  faixaSalarialMax: number | null;
  beneficios: string[];
  posicoes: number;
  status: VagaRegistro['status'];
  prazoInscricoes: Date | null;
  inscricoesEncerradasEm: Date | null;
  pausadaEm: Date | null;
  statusAntesDaPausa: VagaRegistro['statusAntesDaPausa'];
  fechadaEm: Date | null;
  motivoFechamento: string | null;
  alertaPausaEm: Date | null;
  criadoEm: Date;
  atualizadoEm: Date;
}): VagaRegistro {
  return { ...vaga };
}

export class VagasPrisma {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly com: <T>(ctx: ContextoTenant, fn: (tx: Tx) => Promise<T>) => Promise<T>,
  ) {}

  async garantirHabilidade(nome: string, categoria = 'geral'): Promise<HabilidadeCatalogo> {
    const limpo = nome.trim();
    const existente = await this.prisma.habilidade.findFirst({
      where: { nome: { equals: limpo, mode: 'insensitive' } },
    });
    if (existente) return { id: existente.id, nome: existente.nome, categoria: existente.categoria, sinonimos: existente.sinonimos };
    const criada = await this.prisma.habilidade.create({ data: { nome: limpo, categoria, sinonimos: [] } });
    return { id: criada.id, nome: criada.nome, categoria: criada.categoria, sinonimos: criada.sinonimos };
  }

  async buscarHabilidade(id: string): Promise<HabilidadeCatalogo | null> {
    const item = await this.prisma.habilidade.findUnique({ where: { id } });
    return item ? { id: item.id, nome: item.nome, categoria: item.categoria, sinonimos: item.sinonimos } : null;
  }

  async listarHabilidades(): Promise<HabilidadeCatalogo[]> {
    const itens = await this.prisma.habilidade.findMany({ orderBy: { nome: 'asc' } });
    return itens.map((item) => ({ id: item.id, nome: item.nome, categoria: item.categoria, sinonimos: item.sinonimos }));
  }

  criarVaga(dados: VagaRegistro, ctx: ContextoTenant): Promise<VagaRegistro> {
    return this.com(ctx, async (tx) => {
      const criada = await tx.vaga.create({ data: this.dadosVaga(dados) });
      return vagaDe(criada);
    });
  }

  atualizarVaga(id: string, patch: Partial<VagaRegistro>, ctx: ContextoTenant): Promise<VagaRegistro | null> {
    return this.com(ctx, async (tx) => {
      const atual = await tx.vaga.findUnique({ where: { id } });
      if (!atual) return null;
      const data = definido({
        titulo: patch.titulo,
        descricao: patch.descricao,
        senioridade: patch.senioridade,
        modelo: patch.modelo,
        localidade: patch.localidade,
        tipoContrato: patch.tipoContrato,
        faixaSalarialMin: patch.faixaSalarialMin,
        faixaSalarialMax: patch.faixaSalarialMax,
        beneficios: patch.beneficios,
        posicoes: patch.posicoes,
        status: patch.status,
        prazoInscricoes: patch.prazoInscricoes,
        inscricoesEncerradasEm: patch.inscricoesEncerradasEm,
        pausadaEm: patch.pausadaEm,
        statusAntesDaPausa: patch.statusAntesDaPausa,
        fechadaEm: patch.fechadaEm,
        motivoFechamento: patch.motivoFechamento,
        alertaPausaEm: patch.alertaPausaEm,
        pesosRanking: patch.pesosRanking as Prisma.InputJsonValue | undefined,
      });
      const salva = await tx.vaga.update({ where: { id }, data });
      return vagaDe(salva);
    });
  }

  buscarVaga(id: string, ctx: ContextoTenant): Promise<VagaRegistro | null> {
    return this.com(ctx, async (tx) => {
      const vaga = await tx.vaga.findFirst({ where: { id, ...escopoTenant(ctx) } });
      return vaga ? vagaDe(vaga) : null;
    });
  }

  listarVagasEmpresa(empresaId: string, ctx: ContextoTenant): Promise<VagaRegistro[]> {
    return this.com(ctx, async (tx) => {
      const vagas = await tx.vaga.findMany({ where: { empresaId }, orderBy: { criadoEm: 'desc' } });
      return vagas.map(vagaDe);
    });
  }

  listarVagasPublicas(filtro: FiltroVagaPublica): Promise<VagaRegistro[]> {
    return this.com({ leituraPublica: true }, async (tx) => {
      const vagas = await tx.vaga.findMany({
        where: {
          status: 'PUBLICADA',
          prazoInscricoes: { gt: filtro.agora },
          ...(filtro.senioridade ? { senioridade: filtro.senioridade as SenioridadeVaga } : {}),
          ...(filtro.modelo ? { modelo: filtro.modelo as VagaRegistro['modelo'] } : {}),
          ...(filtro.localidade ? { localidade: { contains: filtro.localidade, mode: 'insensitive' } } : {}),
        },
        include: { habilidades: { include: { habilidade: true } } },
        orderBy: { prazoInscricoes: 'asc' },
      });
      const nome = filtro.habilidade?.toLowerCase();
      return vagas
        .filter((vaga) => !nome || vaga.habilidades.some((item) => item.habilidade.nome.toLowerCase().includes(nome)))
        .map(vagaDe);
    });
  }

  substituirHabilidades(vagaId: string, itens: VagaHabilidadeRegistro[], ctx: ContextoTenant): Promise<VagaHabilidadeRegistro[]> {
    return this.com(ctx, async (tx) => {
      await tx.vagaHabilidade.deleteMany({ where: { vagaId } });
      if (itens.length > 0) {
        await tx.vagaHabilidade.createMany({
          data: itens.map((item) => ({
            vagaId,
            habilidadeId: item.habilidadeId,
            nivelMinimo: item.nivelMinimo,
            peso: item.peso,
            obrigatoria: item.obrigatoria,
          })),
        });
      }
      return this.habilidadesNoTx(tx, vagaId);
    });
  }

  listarHabilidadesVaga(vagaId: string, ctx: ContextoTenant): Promise<VagaHabilidadeRegistro[]> {
    return this.com(ctx, (tx) => this.habilidadesNoTx(tx, vagaId));
  }

  salvarProcesso(dados: ProcessoRegistro, ctx: ContextoTenant): Promise<ProcessoRegistro> {
    return this.com(ctx, async (tx) => {
      const salvo = await tx.processoSeletivo.upsert({
        where: { vagaId: dados.vagaId },
        create: {
          id: dados.id,
          vagaId: dados.vagaId,
          empresaId: dados.empresaId,
          tempoPadraoPorPergunta: dados.tempoPadraoPorPergunta,
          politicaRetry: dados.politicaRetry as unknown as Prisma.InputJsonValue,
          janelaReconexaoSegundos: dados.janelaReconexaoSegundos,
        },
        update: {
          tempoPadraoPorPergunta: dados.tempoPadraoPorPergunta,
          politicaRetry: dados.politicaRetry as unknown as Prisma.InputJsonValue,
          janelaReconexaoSegundos: dados.janelaReconexaoSegundos,
        },
      });
      return this.processoDe(salvo);
    });
  }

  buscarProcessoPorId(id: string, ctx: ContextoTenant): Promise<ProcessoRegistro | null> {
    return this.com(ctx, async (tx) => {
      const processo = await tx.processoSeletivo.findUnique({ where: { id } });
      return processo ? this.processoDe(processo) : null;
    });
  }

  buscarProcessoPorVaga(vagaId: string, ctx: ContextoTenant): Promise<ProcessoRegistro | null> {
    return this.com(ctx, async (tx) => {
      const processo = await tx.processoSeletivo.findUnique({ where: { vagaId } });
      return processo ? this.processoDe(processo) : null;
    });
  }

  salvarEtapa(dados: EtapaRegistro, ctx: ContextoTenant): Promise<EtapaRegistro> {
    return this.com(ctx, async (tx) => {
      const salva = await tx.etapa.upsert({
        where: { id: dados.id },
        create: dados,
        update: { ordem: dados.ordem, tipo: dados.tipo, numeroPerguntas: dados.numeroPerguntas },
      });
      return { ...salva, tipo: salva.tipo as TipoEtapa };
    });
  }

  listarEtapas(processoId: string, ctx: ContextoTenant): Promise<EtapaRegistro[]> {
    return this.com(ctx, async (tx) => {
      const etapas = await tx.etapa.findMany({ where: { processoId }, orderBy: { ordem: 'asc' } });
      return etapas.map((etapa) => ({ ...etapa, tipo: etapa.tipo as TipoEtapa }));
    });
  }

  buscarEtapa(id: string, ctx: ContextoTenant): Promise<EtapaRegistro | null> {
    return this.com(ctx, async (tx) => {
      const etapa = await tx.etapa.findUnique({ where: { id } });
      return etapa ? { ...etapa, tipo: etapa.tipo as TipoEtapa } : null;
    });
  }

  async removerEtapa(id: string, ctx: ContextoTenant): Promise<void> {
    await this.com(ctx, (tx) => tx.etapa.delete({ where: { id } }).then(() => undefined));
  }

  criarPergunta(dados: PerguntaRegistro, ctx: ContextoTenant): Promise<PerguntaRegistro> {
    return this.com(ctx, async (tx) => this.perguntaDe(await tx.pergunta.create({ data: this.dadosPergunta(dados) })));
  }

  atualizarPergunta(id: string, patch: Partial<PerguntaRegistro>, ctx: ContextoTenant): Promise<PerguntaRegistro | null> {
    return this.com(ctx, async (tx) => {
      const atual = await tx.pergunta.findUnique({ where: { id } });
      if (!atual) return null;
      const data = definido({
        enunciado: patch.enunciado,
        rubrica: patch.rubrica as Prisma.InputJsonValue | undefined,
        origem: patch.origem,
        statusSugestao: patch.statusSugestao,
        versaoPrompt: patch.versaoPrompt,
        etapaAlvoId: patch.etapaAlvoId,
        tempoLimiteSegundos: patch.tempoLimiteSegundos,
      });
      return this.perguntaDe(await tx.pergunta.update({ where: { id }, data }));
    });
  }

  buscarPergunta(id: string, ctx: ContextoTenant): Promise<PerguntaRegistro | null> {
    return this.com(ctx, async (tx) => {
      const pergunta = await tx.pergunta.findUnique({ where: { id } });
      return pergunta ? this.perguntaDe(pergunta) : null;
    });
  }

  listarPerguntasEmpresa(empresaId: string, ctx: ContextoTenant): Promise<PerguntaRegistro[]> {
    return this.com(ctx, async (tx) => {
      const perguntas = await tx.pergunta.findMany({ where: { empresaId }, orderBy: { criadoEm: 'desc' } });
      return perguntas.map((item) => this.perguntaDe(item));
    });
  }

  listarSugestoesEtapa(etapaId: string, ctx: ContextoTenant): Promise<PerguntaRegistro[]> {
    return this.com(ctx, async (tx) => {
      const perguntas = await tx.pergunta.findMany({ where: { etapaAlvoId: etapaId, statusSugestao: 'PENDENTE' } });
      return perguntas.map((item) => this.perguntaDe(item));
    });
  }

  vincularPergunta(dados: EtapaPerguntaRegistro, ctx: ContextoTenant): Promise<EtapaPerguntaRegistro> {
    return this.com(ctx, async (tx) => {
      const vinculo = await tx.etapaPergunta.create({ data: dados });
      return vinculo;
    });
  }

  listarVinculosEtapa(etapaId: string, ctx: ContextoTenant): Promise<EtapaPerguntaRegistro[]> {
    return this.com(ctx, async (tx) => {
      const vinculos = await tx.etapaPergunta.findMany({ where: { etapaId }, orderBy: { ordem: 'asc' } });
      return vinculos;
    });
  }

  registrarEventoVaga(evento: EventoVagaRegistro, ctx: ContextoTenant): Promise<EventoVagaRegistro> {
    return this.com(ctx, async (tx) => {
      const salvo = await tx.eventoVaga.create({
        data: { ...evento, payload: evento.payload as Prisma.InputJsonValue },
      });
      return { ...salvo, payload: rubrica(salvo.payload) };
    });
  }

  buscarEventoVaga(id: string, ctx: ContextoTenant): Promise<EventoVagaRegistro | null> {
    return this.com(ctx, async (tx) => {
      const evento = await tx.eventoVaga.findUnique({ where: { id } });
      return evento ? { ...evento, payload: rubrica(evento.payload) } : null;
    });
  }

  async marcarEventoConsumido(id: string, quando: Date, ctx: ContextoTenant): Promise<void> {
    await this.com(ctx, (tx) => tx.eventoVaga.update({ where: { id }, data: { consumidoEm: quando } }).then(() => undefined));
  }

  listarEventosVaga(vagaId: string, ctx: ContextoTenant): Promise<EventoVagaRegistro[]> {
    return this.com(ctx, async (tx) => {
      const eventos = await tx.eventoVaga.findMany({ where: { vagaId }, orderBy: { criadoEm: 'asc' } });
      return eventos.map((evento) => ({ ...evento, payload: rubrica(evento.payload) }));
    });
  }

  listarPublicadasVencidas(agora: Date, ctx: ContextoTenant): Promise<VagaRegistro[]> {
    return this.com(ctx, async (tx) => {
      const vagas = await tx.vaga.findMany({
        where: { status: 'PUBLICADA', prazoInscricoes: { lte: agora } },
      });
      return vagas.map(vagaDe);
    });
  }

  listarPausasParaAlerta(limite: Date, ctx: ContextoTenant): Promise<VagaRegistro[]> {
    return this.com(ctx, async (tx) => {
      const vagas = await tx.vaga.findMany({
        where: { status: 'PAUSADA', alertaPausaEm: null, pausadaEm: { lte: limite } },
      });
      return vagas.map(vagaDe);
    });
  }

  pausarPublicadas(empresaId: string, quando: Date, ctx: ContextoTenant): Promise<number> {
    return this.com(ctx, async (tx) => {
      const alvos = await tx.vaga.findMany({ where: { empresaId, status: 'PUBLICADA' } });
      for (const vaga of alvos) {
        await tx.vaga.update({
          where: { id: vaga.id },
          data: { status: 'PAUSADA', statusAntesDaPausa: 'PUBLICADA', pausadaEm: quando, alertaPausaEm: null },
        });
        await tx.eventoVaga.create({
          data: {
            id: randomUUID(),
            empresaId,
            vagaId: vaga.id,
            tipo: 'VagaPausada',
            payload: {
              tipo: 'VagaPausada',
              vagaId: vaga.id,
              empresaId,
              ocorridoEm: quando.toISOString(),
              efeitos: [...EFEITOS_EVENTO_VAGA.VagaPausada],
              origem: 'SUSPENSAO_EMPRESA',
            },
            criadoEm: quando,
          },
        });
      }
      return alvos.length;
    });
  }

  private dadosVaga(dados: VagaRegistro): Prisma.VagaCreateInput {
    return {
      id: dados.id,
      empresa: { connect: { id: dados.empresaId } },
      titulo: dados.titulo,
      descricao: dados.descricao,
      senioridade: dados.senioridade,
      modelo: dados.modelo,
      localidade: dados.localidade,
      tipoContrato: dados.tipoContrato,
      faixaSalarialMin: dados.faixaSalarialMin,
      faixaSalarialMax: dados.faixaSalarialMax,
      beneficios: dados.beneficios,
      posicoes: dados.posicoes,
      status: dados.status,
      prazoInscricoes: dados.prazoInscricoes,
      inscricoesEncerradasEm: dados.inscricoesEncerradasEm,
      pausadaEm: dados.pausadaEm,
      statusAntesDaPausa: dados.statusAntesDaPausa,
      fechadaEm: dados.fechadaEm,
      motivoFechamento: dados.motivoFechamento,
      alertaPausaEm: dados.alertaPausaEm,
      pesosRanking: (dados.pesosRanking ?? {}) as Prisma.InputJsonValue,
      criadoEm: dados.criadoEm,
      atualizadoEm: dados.atualizadoEm,
    };
  }

  private dadosPergunta(dados: PerguntaRegistro): Prisma.PerguntaCreateInput {
    return {
      id: dados.id,
      empresa: { connect: { id: dados.empresaId } },
      enunciado: dados.enunciado,
      rubrica: dados.rubrica as Prisma.InputJsonValue,
      origem: dados.origem,
      statusSugestao: dados.statusSugestao,
      versaoPrompt: dados.versaoPrompt,
      etapaAlvo: dados.etapaAlvoId ? { connect: { id: dados.etapaAlvoId } } : undefined,
      tempoLimiteSegundos: dados.tempoLimiteSegundos,
    };
  }

  private processoDe(processo: {
    id: string;
    vagaId: string;
    empresaId: string;
    tempoPadraoPorPergunta: number;
    politicaRetry: Prisma.JsonValue;
    janelaReconexaoSegundos: number;
  }): ProcessoRegistro {
    return { ...processo, politicaRetry: politica(processo.politicaRetry) };
  }

  private perguntaDe(pergunta: {
    id: string;
    empresaId: string;
    enunciado: string;
    rubrica: Prisma.JsonValue;
    origem: PerguntaRegistro['origem'];
    statusSugestao: StatusSugestao;
    versaoPrompt: string | null;
    etapaAlvoId: string | null;
    tempoLimiteSegundos: number | null;
  }): PerguntaRegistro {
    return { ...pergunta, rubrica: rubrica(pergunta.rubrica) };
  }

  private async habilidadesNoTx(tx: Tx, vagaId: string): Promise<VagaHabilidadeRegistro[]> {
    const itens = await tx.vagaHabilidade.findMany({ where: { vagaId }, include: { habilidade: true } });
    return itens.map((item) => ({
      vagaId: item.vagaId,
      habilidadeId: item.habilidadeId,
      nome: item.habilidade.nome,
      nivelMinimo: item.nivelMinimo,
      peso: item.peso,
      obrigatoria: item.obrigatoria,
    }));
  }
}
