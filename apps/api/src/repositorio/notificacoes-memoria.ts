import type { SugestaoMatchRegistro } from './match-tipos';
import type {
  FiltroNotificacoes,
  NotificacaoNova,
  NotificacaoRegistro,
  PaginaNotificacoes,
  PreferenciaNotificacaoRegistro,
} from './notificacoes-tipos';
import type { ContextoTenant } from './tipos';

export interface FonteNotificacoesMemoria {
  sugestoes: Map<string, SugestaoMatchRegistro>;
  empresaDaVaga(vagaId: string): string | null;
}

function permitido(ctx: ContextoTenant, empresaId: string | null): boolean {
  if (ctx.sistema || ctx.isAdmin || empresaId === null) return true;
  return ctx.empresaId === empresaId;
}

function naCentral(item: NotificacaoRegistro): boolean {
  return item.dados.central !== false;
}

export class NotificacoesMemoria {
  notificacoes = new Map<string, NotificacaoRegistro>();
  preferencias: PreferenciaNotificacaoRegistro[] = [];

  constructor(private readonly fonte: FonteNotificacoesMemoria) {}

  limpar(): void {
    this.notificacoes.clear();
    this.preferencias = [];
  }

  async inserirNotificacaoUnica(dados: NotificacaoNova, ctx: ContextoTenant): Promise<NotificacaoRegistro | null> {
    if (!permitido(ctx, dados.empresaId) || this.porChave(dados.chaveDedup)) return null;
    const registro: NotificacaoRegistro = { ...dados, dados: { ...dados.dados }, agrupadas: 1, lidaEm: null };
    this.notificacoes.set(registro.id, registro);
    return { ...registro };
  }

  async agruparNotificacao(dados: NotificacaoNova, ctx: ContextoTenant): Promise<NotificacaoRegistro | null> {
    if (!permitido(ctx, dados.empresaId)) return null;
    const atual = this.porChave(dados.chaveDedup);
    const registro: NotificacaoRegistro = atual
      ? { ...atual, dados: { ...dados.dados }, agrupadas: atual.agrupadas + 1, lidaEm: null }
      : { ...dados, dados: { ...dados.dados }, agrupadas: 1, lidaEm: null };
    this.notificacoes.set(registro.id, registro);
    return { ...registro };
  }

  async listarNotificacoes(filtro: FiltroNotificacoes, ctx: ContextoTenant): Promise<PaginaNotificacoes> {
    const doUsuario = [...this.notificacoes.values()]
      .filter(
        (item) =>
          item.usuarioId === filtro.usuarioId &&
          naCentral(item) &&
          permitido(ctx, item.empresaId) &&
          (filtro.empresaId === undefined || item.empresaId === filtro.empresaId),
      )
      .sort((a, b) => b.criadoEm.getTime() - a.criadoEm.getTime() || b.id.localeCompare(a.id));
    const inicio = (filtro.pagina - 1) * filtro.limite;
    return {
      itens: doUsuario.slice(inicio, inicio + filtro.limite).map((item) => ({ ...item, dados: { ...item.dados } })),
      total: doUsuario.length,
      naoLidas: doUsuario.filter((item) => item.lidaEm === null).length,
    };
  }

  async marcarNotificacaoLida(id: string, usuarioId: string, quando: Date, ctx: ContextoTenant): Promise<NotificacaoRegistro | null> {
    const atual = this.notificacoes.get(id);
    if (!atual || atual.usuarioId !== usuarioId || !permitido(ctx, atual.empresaId)) return null;
    const lida = { ...atual, lidaEm: atual.lidaEm ?? quando };
    this.notificacoes.set(id, lida);
    return { ...lida };
  }

  async marcarTodasLidas(usuarioId: string, empresaId: string | undefined, quando: Date, ctx: ContextoTenant): Promise<number> {
    let total = 0;
    for (const item of this.notificacoes.values()) {
      if (item.usuarioId !== usuarioId || item.lidaEm !== null || !permitido(ctx, item.empresaId)) continue;
      if (empresaId !== undefined && item.empresaId !== empresaId) continue;
      item.lidaEm = quando;
      total += 1;
    }
    return total;
  }

  async listarPreferencias(usuarioId: string, empresaId: string, ctx: ContextoTenant): Promise<PreferenciaNotificacaoRegistro[]> {
    if (!permitido(ctx, empresaId)) return [];
    return this.preferencias
      .filter((item) => item.usuarioId === usuarioId && item.empresaId === empresaId)
      .map((item) => ({ ...item }));
  }

  async salvarPreferencia(preferencia: PreferenciaNotificacaoRegistro, ctx: ContextoTenant): Promise<PreferenciaNotificacaoRegistro | null> {
    if (!permitido(ctx, preferencia.empresaId)) return null;
    this.preferencias = this.preferencias.filter(
      (item) =>
        !(item.usuarioId === preferencia.usuarioId && item.empresaId === preferencia.empresaId && item.tipo === preferencia.tipo),
    );
    this.preferencias.push({ ...preferencia });
    return { ...preferencia };
  }

  async buscarSugestao(id: string, ctx: ContextoTenant): Promise<SugestaoMatchRegistro | null> {
    const sugestao = this.fonte.sugestoes.get(id);
    if (!sugestao || !permitido(ctx, this.fonte.empresaDaVaga(sugestao.vagaId))) return null;
    return { ...sugestao };
  }

  async marcarSugestaoNotificada(id: string, quando: Date, ctx: ContextoTenant): Promise<void> {
    const sugestao = this.fonte.sugestoes.get(id);
    if (!sugestao || !permitido(ctx, this.fonte.empresaDaVaga(sugestao.vagaId))) return;
    sugestao.notificadoEm ??= quando;
  }

  private porChave(chave: string): NotificacaoRegistro | undefined {
    for (const item of this.notificacoes.values()) if (item.chaveDedup === chave) return item;
    return undefined;
  }
}
