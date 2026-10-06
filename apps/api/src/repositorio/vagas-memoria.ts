import { randomUUID } from 'node:crypto';

import { EFEITOS_EVENTO_VAGA, visivelNaListaPublica } from '@scv/domain';

import { ErroAplicacao } from '../erros';
import type { ContextoTenant } from './tipos';
import type {
  EtapaPerguntaRegistro,
  EtapaRegistro,
  EventoVagaRegistro,
  FiltroVagaPublica,
  HabilidadeCatalogo,
  PerguntaRegistro,
  ProcessoRegistro,
  VagaHabilidadeRegistro,
  VagaRegistro,
} from './vagas-tipos';

function semIndefinidos<T extends Record<string, unknown>>(patch: T): Partial<T> {
  return Object.fromEntries(Object.entries(patch).filter(([, valor]) => valor !== undefined)) as Partial<T>;
}

function permitido(ctx: ContextoTenant, empresaId: string): boolean {
  if (ctx.sistema || ctx.isAdmin) return true;
  return ctx.empresaId === empresaId;
}

export class VagasMemoria {
  habilidades = new Map<string, HabilidadeCatalogo>();
  vagas = new Map<string, VagaRegistro>();
  habilidadesVaga: VagaHabilidadeRegistro[] = [];
  processos = new Map<string, ProcessoRegistro>();
  etapas = new Map<string, EtapaRegistro>();
  perguntas = new Map<string, PerguntaRegistro>();
  vinculos: EtapaPerguntaRegistro[] = [];
  eventos: EventoVagaRegistro[] = [];

  limpar(): void {
    this.habilidades.clear();
    this.vagas.clear();
    this.habilidadesVaga = [];
    this.processos.clear();
    this.etapas.clear();
    this.perguntas.clear();
    this.vinculos = [];
    this.eventos = [];
  }

  async garantirHabilidade(nome: string, categoria = 'geral'): Promise<HabilidadeCatalogo> {
    const chave = nome.trim().toLowerCase();
    const existente = [...this.habilidades.values()].find((item) => item.nome.toLowerCase() === chave);
    if (existente) return { ...existente };
    const criada = { id: randomUUID(), nome: nome.trim(), categoria, sinonimos: [] as string[] };
    this.habilidades.set(criada.id, criada);
    return { ...criada };
  }

  async buscarHabilidade(id: string): Promise<HabilidadeCatalogo | null> {
    const item = this.habilidades.get(id);
    return item ? { ...item } : null;
  }

  async listarHabilidades(): Promise<HabilidadeCatalogo[]> {
    return [...this.habilidades.values()].map((item) => ({ ...item }));
  }

  async criarVaga(dados: VagaRegistro, ctx: ContextoTenant): Promise<VagaRegistro> {
    if (!permitido(ctx, dados.empresaId)) throw new ErroAplicacao('SEM_PERMISSAO', 403, 'sem permissão');
    this.vagas.set(dados.id, { ...dados, beneficios: [...dados.beneficios] });
    return this.clonarVaga(dados);
  }

  async atualizarVaga(id: string, patch: Partial<VagaRegistro>, ctx: ContextoTenant): Promise<VagaRegistro | null> {
    const atual = this.vagas.get(id);
    if (!atual || !permitido(ctx, atual.empresaId)) return null;
    const proxima = { ...atual, ...semIndefinidos(patch), id: atual.id, empresaId: atual.empresaId };
    this.vagas.set(id, proxima);
    return this.clonarVaga(proxima);
  }

  async buscarVaga(id: string, ctx: ContextoTenant): Promise<VagaRegistro | null> {
    const vaga = this.vagas.get(id);
    if (!vaga || !permitido(ctx, vaga.empresaId)) return null;
    return this.clonarVaga(vaga);
  }

  async listarVagasEmpresa(empresaId: string, ctx: ContextoTenant): Promise<VagaRegistro[]> {
    if (!permitido(ctx, empresaId)) return [];
    return [...this.vagas.values()].filter((vaga) => vaga.empresaId === empresaId).map((vaga) => this.clonarVaga(vaga));
  }

  async listarVagasPublicas(filtro: FiltroVagaPublica): Promise<VagaRegistro[]> {
    return [...this.vagas.values()]
      .filter((vaga) => visivelNaListaPublica(vaga, filtro.agora))
      .filter((vaga) => !filtro.senioridade || vaga.senioridade === filtro.senioridade)
      .filter((vaga) => !filtro.modelo || vaga.modelo === filtro.modelo)
      .filter((vaga) => !filtro.localidade || (vaga.localidade ?? '').toLowerCase().includes(filtro.localidade.toLowerCase()))
      .filter((vaga) => {
        if (!filtro.habilidade) return true;
        const nome = filtro.habilidade.toLowerCase();
        return this.habilidadesVaga.some(
          (item) => item.vagaId === vaga.id && item.nome.toLowerCase().includes(nome),
        );
      })
      .map((vaga) => this.clonarVaga(vaga));
  }

  async substituirHabilidades(
    vagaId: string,
    itens: VagaHabilidadeRegistro[],
    ctx: ContextoTenant,
  ): Promise<VagaHabilidadeRegistro[]> {
    const vaga = await this.buscarVaga(vagaId, ctx);
    if (!vaga) throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'vaga não encontrada');
    this.habilidadesVaga = this.habilidadesVaga.filter((item) => item.vagaId !== vagaId);
    this.habilidadesVaga.push(...itens.map((item) => ({ ...item })));
    return itens.map((item) => ({ ...item }));
  }

  async listarHabilidadesVaga(vagaId: string, ctx: ContextoTenant): Promise<VagaHabilidadeRegistro[]> {
    const vaga = this.vagas.get(vagaId);
    if (!vaga) return [];
    if (ctx.leituraPublica) {
      if (vaga.status !== 'PUBLICADA') return [];
    } else if (!permitido(ctx, vaga.empresaId)) {
      return [];
    }
    return this.habilidadesVaga.filter((item) => item.vagaId === vagaId).map((item) => ({ ...item }));
  }

  async salvarProcesso(dados: ProcessoRegistro, ctx: ContextoTenant): Promise<ProcessoRegistro> {
    if (!permitido(ctx, dados.empresaId)) throw new ErroAplicacao('SEM_PERMISSAO', 403, 'sem permissão');
    this.processos.set(dados.vagaId, { ...dados, politicaRetry: { ...dados.politicaRetry } });
    return { ...dados, politicaRetry: { ...dados.politicaRetry } };
  }

  async buscarProcessoPorId(id: string, ctx: ContextoTenant): Promise<ProcessoRegistro | null> {
    const processo = [...this.processos.values()].find((item) => item.id === id);
    if (!processo || !permitido(ctx, processo.empresaId)) return null;
    return { ...processo, politicaRetry: { ...processo.politicaRetry } };
  }

  async buscarProcessoPorVaga(vagaId: string, ctx: ContextoTenant): Promise<ProcessoRegistro | null> {
    const processo = this.processos.get(vagaId);
    if (!processo || !permitido(ctx, processo.empresaId)) return null;
    return { ...processo, politicaRetry: { ...processo.politicaRetry } };
  }

  async salvarEtapa(dados: EtapaRegistro, ctx: ContextoTenant): Promise<EtapaRegistro> {
    const processo = [...this.processos.values()].find((item) => item.id === dados.processoId);
    if (!processo || !permitido(ctx, processo.empresaId)) throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'processo não encontrado');
    this.etapas.set(dados.id, { ...dados });
    return { ...dados };
  }

  async listarEtapas(processoId: string, ctx: ContextoTenant): Promise<EtapaRegistro[]> {
    const processo = [...this.processos.values()].find((item) => item.id === processoId);
    if (!processo || !permitido(ctx, processo.empresaId)) return [];
    return [...this.etapas.values()]
      .filter((etapa) => etapa.processoId === processoId)
      .sort((a, b) => a.ordem - b.ordem)
      .map((etapa) => ({ ...etapa }));
  }

  async buscarEtapa(id: string, ctx: ContextoTenant): Promise<EtapaRegistro | null> {
    const etapa = this.etapas.get(id);
    if (!etapa) return null;
    const processo = [...this.processos.values()].find((item) => item.id === etapa.processoId);
    if (!processo || !permitido(ctx, processo.empresaId)) return null;
    return { ...etapa };
  }

  async removerEtapa(id: string, ctx: ContextoTenant): Promise<void> {
    const etapa = await this.buscarEtapa(id, ctx);
    if (!etapa) return;
    this.etapas.delete(id);
    this.vinculos = this.vinculos.filter((item) => item.etapaId !== id);
    for (const pergunta of this.perguntas.values()) {
      if (pergunta.etapaAlvoId === id) this.perguntas.set(pergunta.id, { ...pergunta, etapaAlvoId: null });
    }
  }

  async criarPergunta(dados: PerguntaRegistro, ctx: ContextoTenant): Promise<PerguntaRegistro> {
    if (!permitido(ctx, dados.empresaId)) throw new ErroAplicacao('SEM_PERMISSAO', 403, 'sem permissão');
    this.perguntas.set(dados.id, { ...dados, rubrica: { ...dados.rubrica } });
    return { ...dados, rubrica: { ...dados.rubrica } };
  }

  async atualizarPergunta(
    id: string,
    patch: Partial<PerguntaRegistro>,
    ctx: ContextoTenant,
  ): Promise<PerguntaRegistro | null> {
    const atual = this.perguntas.get(id);
    if (!atual || !permitido(ctx, atual.empresaId)) return null;
    const proxima = { ...atual, ...semIndefinidos(patch), id: atual.id, empresaId: atual.empresaId };
    this.perguntas.set(id, proxima);
    return { ...proxima, rubrica: { ...proxima.rubrica } };
  }

  async buscarPergunta(id: string, ctx: ContextoTenant): Promise<PerguntaRegistro | null> {
    const pergunta = this.perguntas.get(id);
    if (!pergunta || !permitido(ctx, pergunta.empresaId)) return null;
    return { ...pergunta, rubrica: { ...pergunta.rubrica } };
  }

  async listarPerguntasEmpresa(empresaId: string, ctx: ContextoTenant): Promise<PerguntaRegistro[]> {
    if (!permitido(ctx, empresaId)) return [];
    return [...this.perguntas.values()]
      .filter((item) => item.empresaId === empresaId)
      .map((item) => ({ ...item, rubrica: { ...item.rubrica } }));
  }

  async listarSugestoesEtapa(etapaId: string, ctx: ContextoTenant): Promise<PerguntaRegistro[]> {
    const etapa = await this.buscarEtapa(etapaId, ctx);
    if (!etapa) return [];
    return [...this.perguntas.values()]
      .filter((item) => item.etapaAlvoId === etapaId && item.statusSugestao === 'PENDENTE')
      .map((item) => ({ ...item, rubrica: { ...item.rubrica } }));
  }

  async vincularPergunta(dados: EtapaPerguntaRegistro, ctx: ContextoTenant): Promise<EtapaPerguntaRegistro> {
    const etapa = await this.buscarEtapa(dados.etapaId, ctx);
    if (!etapa) throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'etapa não encontrada');
    this.vinculos.push({ ...dados });
    return { ...dados };
  }

  async listarVinculosEtapa(etapaId: string, ctx: ContextoTenant): Promise<EtapaPerguntaRegistro[]> {
    const etapa = await this.buscarEtapa(etapaId, ctx);
    if (!etapa) return [];
    return this.vinculos.filter((item) => item.etapaId === etapaId).sort((a, b) => a.ordem - b.ordem).map((item) => ({ ...item }));
  }

  async registrarEventoVaga(evento: EventoVagaRegistro, ctx: ContextoTenant): Promise<EventoVagaRegistro> {
    if (!permitido(ctx, evento.empresaId)) throw new ErroAplicacao('SEM_PERMISSAO', 403, 'sem permissão');
    this.eventos.push({ ...evento, payload: { ...evento.payload } });
    return { ...evento, payload: { ...evento.payload } };
  }

  async buscarEventoVaga(id: string, ctx: ContextoTenant): Promise<EventoVagaRegistro | null> {
    const evento = this.eventos.find((item) => item.id === id);
    if (!evento || !permitido(ctx, evento.empresaId)) return null;
    return { ...evento, payload: { ...evento.payload } };
  }

  async marcarEventoConsumido(id: string, quando: Date, ctx: ContextoTenant): Promise<void> {
    const evento = this.eventos.find((item) => item.id === id);
    if (!evento || !permitido(ctx, evento.empresaId)) return;
    evento.consumidoEm = quando;
  }

  async listarEventosVaga(vagaId: string, ctx: ContextoTenant): Promise<EventoVagaRegistro[]> {
    const vaga = this.vagas.get(vagaId);
    if (!vaga || !permitido(ctx, vaga.empresaId)) return [];
    return this.eventos.filter((item) => item.vagaId === vagaId).map((item) => ({ ...item, payload: { ...item.payload } }));
  }

  async listarPublicadasVencidas(agora: Date, ctx: ContextoTenant): Promise<VagaRegistro[]> {
    return [...this.vagas.values()]
      .filter((vaga) => permitido(ctx, vaga.empresaId) || ctx.sistema)
      .filter((vaga) => vaga.status === 'PUBLICADA' && vaga.prazoInscricoes !== null && vaga.prazoInscricoes.getTime() <= agora.getTime())
      .map((vaga) => this.clonarVaga(vaga));
  }

  async listarPausasParaAlerta(limite: Date, ctx: ContextoTenant): Promise<VagaRegistro[]> {
    return [...this.vagas.values()]
      .filter((vaga) => permitido(ctx, vaga.empresaId) || ctx.sistema)
      .filter(
        (vaga) =>
          vaga.status === 'PAUSADA' &&
          vaga.pausadaEm !== null &&
          vaga.alertaPausaEm === null &&
          vaga.pausadaEm.getTime() <= limite.getTime(),
      )
      .map((vaga) => this.clonarVaga(vaga));
  }

  async pausarPublicadas(empresaId: string, quando: Date, ctx: ContextoTenant): Promise<number> {
    if (!permitido(ctx, empresaId)) return 0;
    const alvos = [...this.vagas.values()].filter((vaga) => vaga.empresaId === empresaId && vaga.status === 'PUBLICADA');
    for (const vaga of alvos) {
      vaga.status = 'PAUSADA';
      vaga.statusAntesDaPausa = 'PUBLICADA';
      vaga.pausadaEm = quando;
      vaga.alertaPausaEm = null;
      vaga.atualizadoEm = quando;
      this.eventos.push({
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
        consumidoEm: null,
      });
    }
    return alvos.length;
  }

  private clonarVaga(vaga: VagaRegistro): VagaRegistro {
    return { ...vaga, beneficios: [...vaga.beneficios] };
  }
}
