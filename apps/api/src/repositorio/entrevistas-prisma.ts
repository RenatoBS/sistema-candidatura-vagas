import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';

import { ErroAplicacao } from '../erros';
import type { ContextoTenant } from './tipos';
import type { EntrevistaRegistro } from './entrevistas-tipos';

type Tx = Prisma.TransactionClient;

export class EntrevistasPrisma {
  constructor(
    private readonly com: <T>(ctx: ContextoTenant, fn: (tx: Tx) => Promise<T>) => Promise<T>,
  ) {}

  async criar(dados: EntrevistaRegistro, ctx: ContextoTenant): Promise<EntrevistaRegistro> {
    try {
      return await this.com(ctx, (tx) => tx.entrevista.create({ data: dados }));
    } catch (erro) {
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002')
        throw new ErroAplicacao(
          'ENTREVISTA_JA_EXISTE',
          409,
          'entrevista já existe para esta etapa',
        );
      throw erro;
    }
  }

  buscar(id: string, ctx: ContextoTenant): Promise<EntrevistaRegistro | null> {
    return this.com(ctx, (tx) => tx.entrevista.findUnique({ where: { id } }));
  }

  buscarPorCandidaturaEtapa(
    candidaturaId: string,
    etapaId: string,
    ctx: ContextoTenant,
  ): Promise<EntrevistaRegistro | null> {
    return this.com(ctx, (tx) =>
      tx.entrevista.findUnique({ where: { candidaturaId_etapaId: { candidaturaId, etapaId } } }),
    );
  }

  async atualizar(
    id: string,
    patch: Partial<EntrevistaRegistro>,
    ctx: ContextoTenant,
    esperadoAtualizadoEm?: Date,
  ): Promise<EntrevistaRegistro | null> {
    return this.com(ctx, async (tx) => {
      const data = { ...patch };
      delete data.id;
      const result = await tx.entrevista.updateMany({
        where: { id, ...(esperadoAtualizadoEm ? { atualizadoEm: esperadoAtualizadoEm } : {}) },
        data,
      });
      return result.count ? tx.entrevista.findUnique({ where: { id } }) : null;
    });
  }

  listar(ctx: ContextoTenant): Promise<EntrevistaRegistro[]> {
    return this.com(ctx, (tx) => tx.entrevista.findMany({ orderBy: { criadoEm: 'asc' } }));
  }

  async marcarRespostasParciais(entrevistaId: string, ctx: ContextoTenant): Promise<void> {
    await this.com(ctx, async (tx) => {
      await tx.resposta.updateMany({ where: { entrevistaId }, data: { parcial: true } });
      const entrevista = await tx.entrevista.findUnique({ where: { id: entrevistaId } });
      if (!entrevista) return;
      const perguntas = await tx.etapaPergunta.findMany({
        where: { etapaId: entrevista.etapaId },
        select: { id: true },
      });
      const respondidas = await tx.resposta.findMany({
        where: { entrevistaId },
        select: { etapaPerguntaId: true },
      });
      const ids = new Set(respondidas.map((item) => item.etapaPerguntaId));
      for (const pergunta of perguntas) {
        if (ids.has(pergunta.id)) continue;
        await tx.resposta.create({
          data: {
            id: randomUUID(),
            empresaId: entrevista.empresaId,
            entrevistaId,
            etapaPerguntaId: pergunta.id,
            tipo: 'TEXTO_WHATSAPP',
            statusTranscricao: 'PENDENTE',
            parcial: true,
          },
        });
      }
    });
  }
}
