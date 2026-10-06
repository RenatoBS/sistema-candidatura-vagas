import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import {
  createPrisma,
  grantRlsRole,
  MIGRATION_DATABASE_URL,
  resetDatabase,
  RLS_DATABASE_URL,
  runMigrations,
  runSeed,
  setSessionContext,
} from './helpers';

describe('isolamento multi-tenant RLS (F2-10)', () => {
  let empresaAId = '';
  let empresaBId = '';

  before(async () => {
    await resetDatabase();
    runMigrations();
    await grantRlsRole();
    runSeed();

    const prisma = createPrisma(MIGRATION_DATABASE_URL);
    const empresas = await prisma.empresa.findMany({
      where: { cnpj: { in: ['22222222000122', '33333333000133'] } },
      select: { id: true, cnpj: true },
      orderBy: { cnpj: 'asc' },
    });
    empresaAId = empresas.find((e) => e.cnpj === '22222222000122')!.id;
    empresaBId = empresas.find((e) => e.cnpj === '33333333000133')!.id;
    await prisma.$disconnect();
  });

  after(async () => {
    const prisma = createPrisma(MIGRATION_DATABASE_URL);
    await prisma.$disconnect();
  });

  it('membro da empresa A não lê vagas da empresa B (0 linhas)', async () => {
    const prisma = createPrisma(RLS_DATABASE_URL);
    await setSessionContext(prisma, { empresaId: empresaAId, isAdmin: false });

    const vagas = await prisma.vaga.findMany({
      where: { empresaId: empresaBId },
    });

    assert.equal(vagas.length, 0);
    await prisma.$disconnect();
  });

  it('membro da empresa A vê apenas vagas da própria empresa', async () => {
    const prisma = createPrisma(RLS_DATABASE_URL);
    await setSessionContext(prisma, { empresaId: empresaAId, isAdmin: false });

    const vagas = await prisma.vaga.findMany();
    assert.ok(vagas.length >= 1);
    assert.ok(vagas.every((v) => v.empresaId === empresaAId));
    await prisma.$disconnect();
  });

  it('admin com MFA (is_admin=true) lê vagas de ambas as empresas', async () => {
    const prisma = createPrisma(RLS_DATABASE_URL);
    await setSessionContext(prisma, { isAdmin: true });

    const vagas = await prisma.vaga.findMany({
      where: { empresaId: { in: [empresaAId, empresaBId] } },
    });

    assert.ok(vagas.length >= 2);
    const empresaIds = new Set(vagas.map((v) => v.empresaId));
    assert.ok(empresaIds.has(empresaAId));
    assert.ok(empresaIds.has(empresaBId));
    await prisma.$disconnect();
  });

  it('admin sem MFA não obtém bypass (0 linhas de outra empresa)', async () => {
    const prisma = createPrisma(RLS_DATABASE_URL);
    await setSessionContext(prisma, { empresaId: empresaAId, isAdmin: false });

    const todas = await prisma.vaga.findMany();
    const deB = todas.filter((v) => v.empresaId === empresaBId);
    assert.equal(deB.length, 0);
    await prisma.$disconnect();
  });

  it('RLS bloqueia candidaturas cruzadas entre empresas', async () => {
    const prisma = createPrisma(RLS_DATABASE_URL);
    await setSessionContext(prisma, { empresaId: empresaBId, isAdmin: false });

    const candidaturas = await prisma.candidatura.findMany({
      where: { empresaId: empresaAId },
    });
    assert.equal(candidaturas.length, 0);
    await prisma.$disconnect();
  });
});
