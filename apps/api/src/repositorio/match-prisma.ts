import { Prisma, PrismaClient } from '@prisma/client';
import type { HabilidadeCandidatoMatch, StatusVaga } from '@scv/domain';

import type {
  CandidatoSimilar,
  EntradaSugestaoMatch,
  ResultadoSugestaoMatch,
  StatusSugestaoMatch,
  SugestaoMatchRegistro,
  VagaSimilar,
} from './match-tipos';
import type { ContextoTenant } from './tipos';

type Tx = Prisma.TransactionClient;

/** Literal pgvector (`[0.1,0.2,...]`), passado como parâmetro e convertido com `::vector`. */
function literalVetor(vetor: readonly number[]): string {
  if (vetor.length === 0 || !vetor.every((valor) => Number.isFinite(valor))) {
    throw new Error('embedding inválido');
  }
  return `[${vetor.join(',')}]`;
}

/** HNSW filtra depois da busca: amplia a lista de candidatos ao índice para não faltar resultado. */
function efSearch(limite: number): string {
  return String(Math.min(1000, Math.max(40, limite * 4)));
}

function sugestaoDe(item: {
  id: string;
  vagaId: string;
  candidatoId: string;
  compatibilidade: number;
  explicacao: Prisma.JsonValue;
  status: string;
  notificadoEm: Date | null;
  criadoEm: Date;
  atualizadoEm: Date;
}): SugestaoMatchRegistro {
  const explicacao =
    item.explicacao && typeof item.explicacao === 'object' && !Array.isArray(item.explicacao)
      ? (item.explicacao as Record<string, unknown>)
      : {};
  return { ...item, explicacao, status: item.status as StatusSugestaoMatch };
}

/**
 * Busca vetorial com pgvector (`<=>` = distância de cosseno, índice HNSW).
 * Leituras de vaga respeitam o RLS: tenant da vaga, ou sistema + leitura pública
 * (vagas publicadas no prazo) no sentido candidato → vagas.
 */
export class MatchPrisma {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly com: <T>(ctx: ContextoTenant, fn: (tx: Tx) => Promise<T>) => Promise<T>,
  ) {}

  async salvarEmbeddingVaga(vagaId: string, vetor: number[], ctx: ContextoTenant): Promise<boolean> {
    const literal = literalVetor(vetor);
    const linhas = await this.com(
      ctx,
      (tx) => tx.$executeRaw`UPDATE vagas SET embedding = ${literal}::vector WHERE id = ${vagaId}::uuid`,
    );
    return linhas > 0;
  }

  async salvarEmbeddingCandidato(candidatoId: string, vetor: number[]): Promise<boolean> {
    const literal = literalVetor(vetor);
    const linhas = await this.prisma.$executeRaw`UPDATE candidatos SET embedding = ${literal}::vector WHERE id = ${candidatoId}::uuid`;
    return linhas > 0;
  }

  buscarCandidatosSimilares(vagaId: string, limite: number, ctx: ContextoTenant): Promise<CandidatoSimilar[]> {
    return this.com(ctx, async (tx) => {
      await tx.$executeRaw`SELECT set_config('hnsw.ef_search', ${efSearch(limite)}, true)`;
      const linhas = await tx.$queryRaw<Array<{ candidatoId: string; similaridade: number }>>`
        WITH alvo AS (
          SELECT embedding FROM vagas WHERE id = ${vagaId}::uuid AND embedding IS NOT NULL
        )
        SELECT c.id::text AS "candidatoId",
               (1 - (c.embedding <=> (SELECT embedding FROM alvo)))::float8 AS similaridade
        FROM candidatos c
        WHERE EXISTS (SELECT 1 FROM alvo)
          AND c.embedding IS NOT NULL
          AND c."visivelParaMatch" = true
          AND NOT EXISTS (
            SELECT 1 FROM vagas_habilidades vh
            WHERE vh."vagaId" = ${vagaId}::uuid
              AND vh.obrigatoria
              AND NOT EXISTS (
                SELECT 1 FROM candidatos_habilidades ch
                WHERE ch."candidatoId" = c.id
                  AND ch."habilidadeId" = vh."habilidadeId"
                  AND ch.nivel >= vh."nivelMinimo"
              )
          )
        ORDER BY c.embedding <=> (SELECT embedding FROM alvo)
        LIMIT ${limite}
      `;
      const habilidades = await this.habilidadesDe(tx, linhas.map((linha) => linha.candidatoId));
      return linhas.map((linha) => ({
        candidatoId: linha.candidatoId,
        similaridade: Number(linha.similaridade),
        habilidades: habilidades.get(linha.candidatoId) ?? [],
      }));
    });
  }

  buscarVagasSimilares(candidatoId: string, agora: Date, limite: number): Promise<VagaSimilar[]> {
    return this.com({ sistema: true, leituraPublica: true }, async (tx) => {
      await tx.$executeRaw`SELECT set_config('hnsw.ef_search', ${efSearch(limite)}, true)`;
      const linhas = await tx.$queryRaw<
        Array<{ vagaId: string; empresaId: string; status: string; prazoInscricoes: Date | null; similaridade: number }>
      >`
        WITH alvo AS (
          SELECT embedding FROM candidatos WHERE id = ${candidatoId}::uuid AND embedding IS NOT NULL
        )
        SELECT v.id::text AS "vagaId",
               v."empresaId"::text AS "empresaId",
               v.status::text AS status,
               v."prazoInscricoes",
               (1 - (v.embedding <=> (SELECT embedding FROM alvo)))::float8 AS similaridade
        FROM vagas v
        WHERE EXISTS (SELECT 1 FROM alvo)
          AND v.embedding IS NOT NULL
          AND v.status = 'PUBLICADA'
          AND v."prazoInscricoes" > ${agora}
          AND NOT EXISTS (
            SELECT 1 FROM vagas_habilidades vh
            WHERE vh."vagaId" = v.id
              AND vh.obrigatoria
              AND NOT EXISTS (
                SELECT 1 FROM candidatos_habilidades ch
                WHERE ch."candidatoId" = ${candidatoId}::uuid
                  AND ch."habilidadeId" = vh."habilidadeId"
                  AND ch.nivel >= vh."nivelMinimo"
              )
          )
        ORDER BY v.embedding <=> (SELECT embedding FROM alvo)
        LIMIT ${limite}
      `;
      return linhas.map((linha) => ({
        vagaId: linha.vagaId,
        empresaId: linha.empresaId,
        status: linha.status as StatusVaga,
        prazoInscricoes: linha.prazoInscricoes,
        similaridade: Number(linha.similaridade),
      }));
    });
  }

  registrarSugestao(entrada: EntradaSugestaoMatch, ctx: ContextoTenant): Promise<ResultadoSugestaoMatch | null> {
    return this.com(ctx, async (tx) => {
      const explicacao = JSON.parse(JSON.stringify(entrada.explicacao)) as Prisma.InputJsonValue;
      const salva = await tx.sugestaoMatch.upsert({
        where: { vagaId_candidatoId: { vagaId: entrada.vagaId, candidatoId: entrada.candidatoId } },
        create: {
          vagaId: entrada.vagaId,
          candidatoId: entrada.candidatoId,
          compatibilidade: entrada.compatibilidade,
          explicacao,
          criadoEm: entrada.agora,
        },
        update: { compatibilidade: entrada.compatibilidade, explicacao },
      });
      if (!entrada.forte || salva.status !== 'PENDENTE') return { sugestao: sugestaoDe(salva), tornouForte: false };
      // Condicional no status: dois jobs concorrentes não marcam (nem notificam) duas vezes.
      const { count } = await tx.sugestaoMatch.updateMany({
        where: { id: salva.id, status: 'PENDENTE' },
        data: { status: 'NOTIFICADA' },
      });
      const atual = await tx.sugestaoMatch.findUniqueOrThrow({ where: { id: salva.id } });
      return { sugestao: sugestaoDe(atual), tornouForte: count === 1 };
    });
  }

  listarSugestoesVaga(vagaId: string, ctx: ContextoTenant): Promise<SugestaoMatchRegistro[]> {
    return this.com(ctx, async (tx) => {
      const itens = await tx.sugestaoMatch.findMany({ where: { vagaId }, orderBy: { compatibilidade: 'desc' } });
      return itens.map(sugestaoDe);
    });
  }

  listarSugestoesCandidato(candidatoId: string, ctx: ContextoTenant): Promise<SugestaoMatchRegistro[]> {
    return this.com(ctx, async (tx) => {
      const itens = await tx.sugestaoMatch.findMany({ where: { candidatoId }, orderBy: { compatibilidade: 'desc' } });
      return itens.map(sugestaoDe);
    });
  }

  private async habilidadesDe(tx: Tx, candidatoIds: string[]): Promise<Map<string, HabilidadeCandidatoMatch[]>> {
    const mapa = new Map<string, HabilidadeCandidatoMatch[]>();
    if (candidatoIds.length === 0) return mapa;
    const linhas = await tx.candidatoHabilidade.findMany({
      where: { candidatoId: { in: candidatoIds } },
      include: { habilidade: true },
    });
    for (const linha of linhas) {
      const lista = mapa.get(linha.candidatoId) ?? [];
      lista.push({ habilidadeId: linha.habilidadeId, nome: linha.habilidade.nome, nivel: linha.nivel });
      mapa.set(linha.candidatoId, lista);
    }
    return mapa;
  }
}
