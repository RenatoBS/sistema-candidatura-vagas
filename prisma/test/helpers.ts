import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

/** URL para migrações/seeds (superusuário — necessário para CREATE EXTENSION). */
export const MIGRATION_DATABASE_URL =
  process.env.MIGRATION_DATABASE_URL ??
  process.env.DATABASE_URL ??
  'postgresql://scv:scv_ci_password@localhost:5432/scv_test?schema=public';

/** URL para testes de RLS (papel sem BYPASSRLS). */
export const RLS_DATABASE_URL =
  process.env.RLS_DATABASE_URL ??
  'postgresql://scv_rls:scv_rls_password@localhost:5432/scv_test?schema=public';

const prismaDir = new URL('..', import.meta.url).pathname;

export function runMigrations(databaseUrl: string = MIGRATION_DATABASE_URL): void {
  execSync('pnpm exec prisma migrate deploy --schema=schema', {
    cwd: prismaDir,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'pipe',
  });
}

export function runSeed(databaseUrl: string = MIGRATION_DATABASE_URL): void {
  execSync('pnpm exec prisma db seed --schema=schema', {
    cwd: prismaDir,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'pipe',
  });
}

export function createPrisma(databaseUrl: string): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  });
}

export async function setSessionContext(
  prisma: PrismaClient,
  context: { empresaId?: string; isAdmin?: boolean },
): Promise<void> {
  const empresaId = context.empresaId ?? '';
  const isAdmin = context.isAdmin ? 'true' : 'false';
  await prisma.$executeRaw`
    SELECT
      set_config('app.empresa_id', ${empresaId}, false),
      set_config('app.is_admin', ${isAdmin}, false)
  `;
}

/** Recria schema e papel scv_rls para testes de isolamento. */
export async function resetDatabase(adminUrl = MIGRATION_DATABASE_URL): Promise<void> {
  const admin = createPrisma(adminUrl);
  try {
    await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS public CASCADE`);
    await admin.$executeRawUnsafe(`CREATE SCHEMA public`);
    await admin.$executeRawUnsafe(`GRANT ALL ON SCHEMA public TO PUBLIC`);
    await admin.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS vector`);

    await admin.$executeRawUnsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'scv_rls') THEN
          CREATE ROLE scv_rls LOGIN PASSWORD 'scv_rls_password' NOSUPERUSER NOBYPASSRLS;
        END IF;
      END $$
    `);
  } finally {
    await admin.$disconnect();
  }
}

/** Concede permissões ao papel scv_rls após migrações. */
export async function grantRlsRole(adminUrl = MIGRATION_DATABASE_URL): Promise<void> {
  const admin = createPrisma(adminUrl);
  try {
    await admin.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO scv_rls`);
    await admin.$executeRawUnsafe(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO scv_rls`,
    );
    await admin.$executeRawUnsafe(
      `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO scv_rls`,
    );
  } finally {
    await admin.$disconnect();
  }
}
