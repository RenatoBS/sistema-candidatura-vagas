import { Prisma } from '@prisma/client';
import type { StatusCandidatura } from '@scv/domain';

import { ErroAplicacao } from '../erros';
import type {
  CandidaturaRegistro,
  HistoricoStatusRegistro,
  TransicaoCandidaturaRegistro,
} from './candidaturas-tipos';
import { escopoTenant } from './escopo';
import type { ContextoTenant } from './tipos';

type Tx = Prisma.TransactionClient;

function historicoDe(item: {
  id: string;
  candidaturaId: string;
  de: string;
  para: string;
  autorId: string | null;
  motivo: string | null;
  criadoEm: Date;
}): HistoricoStatusRegistro {
  return { ...item, para: item.para as StatusCandidatura };
}

/** Candidaturas não têm política `app.is_system`: sempre no contexto do tenant dono da vaga. */
export class CandidaturasPrisma {
  constructor(
    private readonly com: <T>(ctx: ContextoTenant, fn: (tx: Tx) => Promise<T>) => Promise<T>,
  ) {}

  async criarCandidatura(
    dados: CandidaturaRegistro,
    historico: HistoricoStatusRegistro,
    ctx: ContextoTenant,
  ): Promise<CandidaturaRegistro> {
    try {
      return await this.com(ctx, async (tx) => {
        const criada = await tx.candidatura.create({ data: dados });
        await tx.historicoStatus.create({ data: historico });
        return criada;
      });
    } catch (erro) {
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002') {
        throw new ErroAplicacao('CANDIDATURA_DUPLICADA', 409, 'candidatura já existe para esta vaga');
      }
      throw erro;
    }
  }

  buscarCandidatura(id: string, ctx: ContextoTenant): Promise<CandidaturaRegistro | null> {
    return this.com(ctx, (tx) => tx.candidatura.findFirst({ where: { id, ...escopoTenant(ctx) } }));
  }

  listarCandidaturasVaga(vagaId: string, ctx: ContextoTenant): Promise<CandidaturaRegistro[]> {
    return this.com(ctx, (tx) => tx.candidatura.findMany({ where: { vagaId }, orderBy: { criadoEm: 'asc' } }));
  }

  listarCandidaturasCandidato(candidatoId: string, ctx: ContextoTenant): Promise<CandidaturaRegistro[]> {
    return this.com(ctx, (tx) => tx.candidatura.findMany({ where: { candidatoId }, orderBy: { criadoEm: 'desc' } }));
  }

  transicionarCandidatura(
    transicao: TransicaoCandidaturaRegistro,
    ctx: ContextoTenant,
  ): Promise<CandidaturaRegistro | null> {
    return this.com(ctx, async (tx) => {
      const { count } = await tx.candidatura.updateMany({
        where: {
          id: transicao.candidaturaId,
          ...escopoTenant(ctx),
          status: transicao.esperado.status,
          atualizadoEm: transicao.esperado.atualizadoEm,
        },
        data: transicao.proximo,
      });
      if (count === 0) return null;
      await tx.historicoStatus.create({ data: transicao.historico });
      return tx.candidatura.findFirst({ where: { id: transicao.candidaturaId, ...escopoTenant(ctx) } });
    });
  }

  listarHistoricoStatus(candidaturaId: string, ctx: ContextoTenant): Promise<HistoricoStatusRegistro[]> {
    return this.com(ctx, async (tx) => {
      const itens = await tx.historicoStatus.findMany({ where: { candidaturaId }, orderBy: { criadoEm: 'asc' } });
      return itens.map(historicoDe);
    });
  }
}
