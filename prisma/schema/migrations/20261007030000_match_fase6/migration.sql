-- Fase 6 (F6-04) — embeddings com índice HNSW, visibilidade opt-in e jobs de match.

-- Q17 (decisão provisória): visibilidade para match é opt-in. Só muda o padrão
-- de novos candidatos; linhas existentes mantêm o valor atual.
ALTER TABLE "candidatos" ALTER COLUMN "visivelParaMatch" SET DEFAULT false;

-- Busca vetorial por distância de cosseno (operador <=>). O Prisma não modela
-- índices HNSW: mantê-los aqui, fora do schema.
CREATE INDEX IF NOT EXISTS "vagas_embedding_hnsw_idx"
  ON "vagas" USING hnsw ("embedding" vector_cosine_ops);

CREATE INDEX IF NOT EXISTS "candidatos_embedding_hnsw_idx"
  ON "candidatos" USING hnsw ("embedding" vector_cosine_ops);

CREATE INDEX IF NOT EXISTS "sugestoes_match_candidatoId_idx"
  ON "sugestoes_match"("candidatoId");

-- O job de match candidato → vagas grava sugestões de várias empresas.
CREATE POLICY sugestoes_match_sistema ON sugestoes_match
  FOR ALL
  USING (current_setting('app.is_system', true) = 'true')
  WITH CHECK (current_setting('app.is_system', true) = 'true');
