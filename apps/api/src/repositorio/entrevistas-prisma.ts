import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { lerContexto } from '@scv/domain';

import { ErroAplicacao } from '../erros';
import type { EntrevistaRegistro } from './entrevistas-tipos';
import type { ContextoTenant } from './tipos';

function jsonContexto(valor: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(valor ?? {})) as Prisma.InputJsonValue;
}

type Tx = Prisma.TransactionClient;

export class EntrevistasPrisma {
  constructor(
    private readonly com: <T>(ctx: ContextoTenant, fn: (tx: Tx) => Promise<T>) => Promise<T>,
  ) {}

  async criar(dados: EntrevistaRegistro, ctx: ContextoTenant): Promise<EntrevistaRegistro> {
    try {
      const criada = await this.com(ctx, (tx) =>
        tx.entrevista.create({
          data: { ...dados, contexto: jsonContexto(dados.contexto) },
        }),
      );
      return this.registro(criada);
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

  async buscar(id: string, ctx: ContextoTenant): Promise<EntrevistaRegistro | null> {
    const row = await this.com(ctx, (tx) => tx.entrevista.findUnique({ where: { id } }));
    return row ? this.registro(row) : null;
  }

  async buscarPorCandidaturaEtapa(
    candidaturaId: string,
    etapaId: string,
    ctx: ContextoTenant,
  ): Promise<EntrevistaRegistro | null> {
    const row = await this.com(ctx, (tx) =>
      tx.entrevista.findUnique({ where: { candidaturaId_etapaId: { candidaturaId, etapaId } } }),
    );
    return row ? this.registro(row) : null;
  }

  async atualizar(
    id: string,
    patch: Partial<EntrevistaRegistro>,
    ctx: ContextoTenant,
    esperadoAtualizadoEm?: Date,
  ): Promise<EntrevistaRegistro | null> {
    return this.com(ctx, async (tx) => {
      const data: Prisma.EntrevistaUpdateManyMutationInput = {
        ...(patch as Prisma.EntrevistaUpdateManyMutationInput),
        ...(patch.contexto ? { contexto: jsonContexto(patch.contexto) } : {}),
      };
      delete data.id;
      const result = await tx.entrevista.updateMany({
        where: { id, ...(esperadoAtualizadoEm ? { atualizadoEm: esperadoAtualizadoEm } : {}) },
        data,
      });
      return result.count ? tx.entrevista.findUnique({ where: { id } }) : null;
    }).then((row) => (row ? this.registro(row) : null));
  }

  async listar(ctx: ContextoTenant): Promise<EntrevistaRegistro[]> {
    const rows = await this.com(ctx, (tx) => tx.entrevista.findMany({ orderBy: { criadoEm: 'asc' } }));
    return rows.map((row) => this.registro(row));
  }

  private registro(row: { contexto: Prisma.JsonValue } & Record<string, unknown>): EntrevistaRegistro {
    return { ...(row as unknown as EntrevistaRegistro), contexto: lerContexto(row.contexto) };
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
            revisaoHumanaNecessaria: true,
          },
        });
      }
    });
  }
}
