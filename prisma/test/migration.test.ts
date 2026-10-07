import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import {
  createPrisma,
  grantRlsRole,
  MIGRATION_DATABASE_URL,
  resetDatabase,
  runMigrations,
  runSeed,
} from './helpers';

describe('migrações Prisma (F2-10)', () => {
  before(async () => {
    await resetDatabase();
    runMigrations();
    await grantRlsRole();
  });

  after(async () => {
    const prisma = createPrisma(MIGRATION_DATABASE_URL);
    await prisma.$disconnect();
  });

  it('aplica migrações do zero e registra _prisma_migrations', async () => {
    const prisma = createPrisma(MIGRATION_DATABASE_URL);
    const migrations = await prisma.$queryRaw<{ migration_name: string }[]>`
      SELECT migration_name FROM "_prisma_migrations" ORDER BY finished_at
    `;
    assert.ok(migrations.length >= 2);
    assert.ok(migrations.some((m) => m.migration_name.includes('init_schema')));
    assert.ok(migrations.some((m) => m.migration_name.includes('enable_rls')));
    await prisma.$disconnect();
  });

  it('cria extensão vector e tabelas principais com timestamptz', async () => {
    const prisma = createPrisma(MIGRATION_DATABASE_URL);
    const ext = await prisma.$queryRaw<{ extname: string }[]>`
      SELECT extname FROM pg_extension WHERE extname = 'vector'
    `;
    assert.equal(ext.length, 1);

    const cols = await prisma.$queryRaw<{ column_name: string; data_type: string }[]>`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'vagas'
        AND column_name IN ('prazoInscricoes', 'criadoEm')
    `;
    const prazo = cols.find((c) => c.column_name === 'prazoInscricoes');
    const criado = cols.find((c) => c.column_name === 'criadoEm');
    assert.equal(prazo?.data_type, 'timestamp with time zone');
    assert.equal(criado?.data_type, 'timestamp with time zone');
    await prisma.$disconnect();
  });

  it('cria índices HNSW de embedding e visibilidade para match opt-in (F6-04)', async () => {
    const prisma = createPrisma(MIGRATION_DATABASE_URL);
    const indices = await prisma.$queryRaw<{ indexname: string; indexdef: string }[]>`
      SELECT indexname, indexdef FROM pg_indexes
      WHERE indexname IN ('vagas_embedding_hnsw_idx', 'candidatos_embedding_hnsw_idx')
    `;
    assert.equal(indices.length, 2);
    assert.ok(indices.every((indice) => /USING hnsw/.test(indice.indexdef) && /vector_cosine_ops/.test(indice.indexdef)));
    const padrao = await prisma.$queryRaw<{ column_default: string }[]>`
      SELECT column_default FROM information_schema.columns
      WHERE table_name = 'candidatos' AND column_name = 'visivelParaMatch'
    `;
    assert.equal(padrao[0]?.column_default, 'false');
    await prisma.$disconnect();
  });

  it('executa seeds sem erro', () => {
    runSeed();
  });
});
