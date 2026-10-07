import { Prisma } from '@prisma/client';
import type { TipoNotificacaoEmpresa } from '@scv/domain';

import type { StatusSugestaoMatch, SugestaoMatchRegistro } from './match-tipos';
import type {
  FiltroNotificacoes,
  NotificacaoNova,
  NotificacaoRegistro,
  PaginaNotificacoes,
  PreferenciaNotificacaoRegistro,
} from './notificacoes-tipos';
import type { ContextoTenant } from './tipos';

type Tx = Prisma.TransactionClient;

function objeto(valor: Prisma.JsonValue): Record<string, unknown> {
  return valor && typeof valor === 'object' && !Array.isArray(valor) ? (valor as Record<string, unknown>) : {};
}

function json(valor: Record<string, unknown>): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(valor)) as Prisma.InputJsonValue;
}

function notificacaoDe(item: {
  id: string;
  usuarioId: string;
  empresaId: string | null;
  tipo: string;
  chaveDedup: string;
  dados: Prisma.JsonValue;
  agrupadas: number;
  lidaEm: Date | null;
  criadoEm: Date;
}): NotificacaoRegistro {
  return { ...item, tipo: item.tipo as TipoNotificacaoEmpresa, dados: objeto(item.dados) };
}

/**
 * Notificações e preferências sob o RLS do tenant (`empresaId` da vaga).
 * Toda linha gravada aqui tem `dados.central` (true/false): a central filtra por igualdade.
 */
export class NotificacoesPrisma {
  constructor(private readonly com: <T>(ctx: ContextoTenant, fn: (tx: Tx) => Promise<T>) => Promise<T>) {}

  async inserirNotificacaoUnica(dados: NotificacaoNova, ctx: ContextoTenant): Promise<NotificacaoRegistro | null> {
    return this.com(ctx, async (tx) => {
      const { count } = await tx.notificacao.createMany({
        data: [{ ...dados, dados: json(dados.dados) }],
        skipDuplicates: true,
      });
      return count === 0 ? null : notificacaoDe(await tx.notificacao.findUniqueOrThrow({ where: { id: dados.id } }));
    });
  }

  /** Upsert atômico (ON CONFLICT): candidaturas concorrentes na mesma janela incrementam a mesma linha. */
  async agruparNotificacao(dados: NotificacaoNova, ctx: ContextoTenant): Promise<NotificacaoRegistro | null> {
    const registro = await this.com(ctx, (tx) =>
      tx.notificacao.upsert({
        where: { chaveDedup: dados.chaveDedup },
        create: { ...dados, dados: json(dados.dados) },
        update: { dados: json(dados.dados), agrupadas: { increment: 1 }, lidaEm: null },
      }),
    );
    return notificacaoDe(registro);
  }

  async listarNotificacoes(filtro: FiltroNotificacoes, ctx: ContextoTenant): Promise<PaginaNotificacoes> {
    const where: Prisma.NotificacaoWhereInput = {
      usuarioId: filtro.usuarioId,
      dados: { path: ['central'], equals: true },
      ...(filtro.empresaId === undefined ? {} : { empresaId: filtro.empresaId }),
    };
    return this.com(ctx, async (tx) => {
      const [itens, total, naoLidas] = await Promise.all([
        tx.notificacao.findMany({
          where,
          orderBy: [{ criadoEm: 'desc' }, { id: 'desc' }],
          skip: (filtro.pagina - 1) * filtro.limite,
          take: filtro.limite,
        }),
        tx.notificacao.count({ where }),
        tx.notificacao.count({ where: { ...where, lidaEm: null } }),
      ]);
      return { itens: itens.map(notificacaoDe), total, naoLidas };
    });
  }

  async marcarNotificacaoLida(id: string, usuarioId: string, quando: Date, ctx: ContextoTenant): Promise<NotificacaoRegistro | null> {
    return this.com(ctx, async (tx) => {
      await tx.notificacao.updateMany({ where: { id, usuarioId, lidaEm: null }, data: { lidaEm: quando } });
      const registro = await tx.notificacao.findFirst({ where: { id, usuarioId } });
      return registro ? notificacaoDe(registro) : null;
    });
  }

  async marcarTodasLidas(usuarioId: string, empresaId: string | undefined, quando: Date, ctx: ContextoTenant): Promise<number> {
    const { count } = await this.com(ctx, (tx) =>
      tx.notificacao.updateMany({
        where: { usuarioId, lidaEm: null, ...(empresaId === undefined ? {} : { empresaId }) },
        data: { lidaEm: quando },
      }),
    );
    return count;
  }

  async listarPreferencias(usuarioId: string, empresaId: string, ctx: ContextoTenant): Promise<PreferenciaNotificacaoRegistro[]> {
    const linhas = await this.com(ctx, (tx) =>
      tx.preferenciaNotificacao.findMany({ where: { usuarioId, empresaId, tipo: { in: ['CANDIDATO_NOVO', 'MATCH_FORTE'] } } }),
    );
    return linhas.map((item) => ({
      usuarioId: item.usuarioId,
      empresaId,
      tipo: item.tipo as TipoNotificacaoEmpresa,
      inApp: item.inApp,
      push: item.push,
      email: item.email,
      limiarMatch: item.limiarMatch,
    }));
  }

  async salvarPreferencia(preferencia: PreferenciaNotificacaoRegistro, ctx: ContextoTenant): Promise<PreferenciaNotificacaoRegistro | null> {
    const canais = {
      inApp: preferencia.inApp,
      push: preferencia.push,
      email: preferencia.email,
      limiarMatch: preferencia.limiarMatch,
    };
    await this.com(ctx, (tx) =>
      tx.preferenciaNotificacao.upsert({
        where: {
          usuarioId_empresaId_tipo: {
            usuarioId: preferencia.usuarioId,
            empresaId: preferencia.empresaId,
            tipo: preferencia.tipo,
          },
        },
        create: { usuarioId: preferencia.usuarioId, empresaId: preferencia.empresaId, tipo: preferencia.tipo, ...canais },
        update: canais,
      }),
    );
    return { ...preferencia };
  }

  async buscarSugestao(id: string, ctx: ContextoTenant): Promise<SugestaoMatchRegistro | null> {
    const item = await this.com(ctx, (tx) => tx.sugestaoMatch.findUnique({ where: { id } }));
    if (!item) return null;
    return { ...item, explicacao: objeto(item.explicacao), status: item.status as StatusSugestaoMatch };
  }

  async marcarSugestaoNotificada(id: string, quando: Date, ctx: ContextoTenant): Promise<void> {
    await this.com(ctx, (tx) => tx.sugestaoMatch.updateMany({ where: { id, notificadoEm: null }, data: { notificadoEm: quando } }));
  }
}
