/**
 * Testes do repositório Prisma da API contra um Postgres DESCARTÁVEL.
 * `resetarBanco` faz DROP SCHEMA: só roda se o banco terminar em `_test` (nunca use o banco `scv`).
 */
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

import { PrismaClient } from '@prisma/client';
import { envOu } from '@scv/env';

export const URL_BANCO_TESTE = envOu(process.env, 'SCV_TEST_DATABASE_URL', '');
if (!URL_BANCO_TESTE) throw new Error('SCV_TEST_DATABASE_URL deve ser definida para os testes Prisma');

function exigirBancoDescartavel(url: string): void {
  const nome = new URL(url).pathname.replace(/^\//, '');
  if (!/_test$/.test(nome)) {
    throw new Error(`recusado: o banco "${nome}" não termina em _test; estes testes fazem DROP SCHEMA`);
  }
}

export function criarPrisma(url = URL_BANCO_TESTE): PrismaClient {
  exigirBancoDescartavel(url);
  return new PrismaClient({ datasources: { db: { url } } });
}

/** Recria o schema e aplica todas as migrações. */
export async function resetarBanco(url = URL_BANCO_TESTE): Promise<void> {
  exigirBancoDescartavel(url);
  const admin = criarPrisma(url);
  try {
    await admin.$executeRawUnsafe('DROP SCHEMA IF EXISTS public CASCADE');
    await admin.$executeRawUnsafe('CREATE SCHEMA public');
    await admin.$executeRawUnsafe('GRANT ALL ON SCHEMA public TO PUBLIC');
    await admin.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS vector');
  } finally {
    await admin.$disconnect();
  }
  execSync('pnpm exec prisma migrate deploy --schema=schema', {
    cwd: new URL('../../../prisma', import.meta.url).pathname,
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });
}

let sequencia = 0;

export async function criarEmpresaEUsuario(prisma: PrismaClient) {
  sequencia += 1;
  const empresa = await prisma.empresa.create({
    data: {
      razaoSocial: `Fixture ${sequencia} Ltda`,
      nomeFantasia: `Fixture ${sequencia}`,
      cnpj: String(10000000000000 + sequencia),
      dominio: 'fixture.test',
      responsavelNome: 'Responsável',
      responsavelEmail: `resp${sequencia}@fixture.test`,
    },
  });
  const usuario = await prisma.usuario.create({
    data: { email: `u${sequencia}@fixture.test`, senhaHash: 'hash-de-teste' },
  });
  return { empresa, usuario };
}

export async function criarVaga(prisma: PrismaClient, empresaId: string) {
  return prisma.vaga.create({
    data: {
      empresaId,
      titulo: 'Vaga de fixture',
      descricao: 'Descrição de fixture.',
      senioridade: 'PLENO',
      modelo: 'REMOTO',
      status: 'PUBLICADA',
      prazoInscricoes: new Date('2099-01-01T00:00:00.000Z'),
    },
  });
}

export async function criarCandidaturaComScore(prisma: PrismaClient, empresaId: string, vagaId: string) {
  sequencia += 1;
  const usuario = await prisma.usuario.create({ data: { email: `cand${sequencia}@fixture.test`, senhaHash: 'hash-de-teste' } });
  const candidato = await prisma.candidato.create({ data: { usuarioId: usuario.id, nome: 'Pessoa Fixture' } });
  const candidatura = await prisma.candidatura.create({
    data: { empresaId, vagaId, candidatoId: candidato.id, origem: 'DIRETA' },
  });
  await prisma.score.create({ data: { candidaturaId: candidatura.id, scoreFinal: 72, completude: 0.5 } });
  return candidatura;
}


const SENHA_APP = envOu(process.env, 'SCV_APP_DB_PASSWORD', '');
const SENHA_APP_EFETIVA = SENHA_APP || (process.env.CI ? randomUUID() : (() => {
  throw new Error('SCV_APP_DB_PASSWORD deve ser definida fora da CI');
})());
const SENHA_APP_SQL = SENHA_APP_EFETIVA.replace(/'/g, "''");

/** Cria o papel de runtime `scv_app` (sem superuser, sem BYPASSRLS) com os mesmos privilégios do init do compose. */
export async function prepararPapelApp(url = URL_BANCO_TESTE): Promise<void> {
  exigirBancoDescartavel(url);
  const admin = criarPrisma(url);
  try {
    await admin.$executeRawUnsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'scv_app') THEN
          CREATE ROLE scv_app LOGIN PASSWORD '${SENHA_APP_SQL}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
        END IF;
      END $$`);
    await admin.$executeRawUnsafe(`ALTER ROLE scv_app NOSUPERUSER NOBYPASSRLS PASSWORD '${SENHA_APP_SQL}'`);
    await admin.$executeRawUnsafe(`GRANT CONNECT ON DATABASE "${new URL(url).pathname.replace(/^\//, '')}" TO scv_app`);
    await admin.$executeRawUnsafe('GRANT USAGE ON SCHEMA public TO scv_app');
    await admin.$executeRawUnsafe('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO scv_app');
    await admin.$executeRawUnsafe('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO scv_app');
    await admin.$executeRawUnsafe('GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO scv_app');
  } finally {
    await admin.$disconnect();
  }
}

/** Mesma URL do banco de teste, mas conectando como o papel de runtime. */
export function urlDoPapelApp(url = URL_BANCO_TESTE): string {
  const copia = new URL(url);
  copia.username = 'scv_app';
  copia.password = SENHA_APP_EFETIVA;
  return copia.toString();
}
