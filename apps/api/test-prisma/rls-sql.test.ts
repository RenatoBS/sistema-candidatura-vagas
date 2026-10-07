import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import type { PrismaClient } from '@prisma/client';

import { avaliarPapelDeRuntime } from '../src/repositorio/papel-runtime';
import { RepositorioPrisma } from '../src/repositorio/prisma';
import { criarPrisma, urlDoPapelApp } from './ajuda';
import { api, derrubarApp, subirAppPostgres } from './http/ajuda-pg';
import { montarCenario, type Cenario } from './http/seed-cenario';

/** Executa `fn` numa transação do papel de runtime com o contexto de tenant dado (como o repositório faz). */
async function comoApp<T>(
  app: PrismaClient,
  contexto: { empresaId?: string; isAdmin?: boolean; sistema?: boolean },
  fn: (tx: Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]) => Promise<T>,
): Promise<T> {
  return app.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.empresa_id', ${contexto.empresaId ?? ''}, true),
      set_config('app.is_admin', ${contexto.isAdmin ? 'true' : 'false'}, true),
      set_config('app.is_system', ${contexto.sistema ? 'true' : 'false'}, true),
      set_config('app.leitura_publica', 'false', true)`;
    return fn(tx);
  });
}

describe('RLS efetivo para o papel de runtime scv_app (FC-03)', () => {
  let cenario: Cenario;
  let app: PrismaClient;
  const admin = criarPrisma();

  before(async () => {
    await subirAppPostgres();
    cenario = await montarCenario();
    app = criarPrisma(urlDoPapelApp());
  });
  after(async () => {
    await app.$disconnect();
    await admin.$disconnect();
    await derrubarApp();
  });

  it('o papel de runtime não é superuser nem tem BYPASSRLS', async () => {
    const [papel] = await app.$queryRaw<Array<{ usuario: string; rolsuper: boolean; rolbypassrls: boolean }>>`
      SELECT current_user::text AS usuario, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`;
    assert.deepEqual(papel, { usuario: 'scv_app', rolsuper: false, rolbypassrls: false });
  });

  it('a checagem de boot da API aprova o scv_app e reprova o papel dono do schema', async () => {
    const comoApp = await new RepositorioPrisma(app).papelDaConexao();
    assert.equal(avaliarPapelDeRuntime(comoApp, 'production').nivel, 'ok');
    const comoDono = await new RepositorioPrisma(admin).papelDaConexao();
    assert.equal(comoDono.rolsuper || comoDono.rolbypassrls, true);
    assert.equal(avaliarPapelDeRuntime(comoDono, 'production').nivel, 'erro');
  });

  it('a API (e não só este teste) conecta como scv_app', async () => {
    await api('/health'); // garante conexões abertas
    const conexoes = await admin.$queryRaw<Array<{ usename: string }>>`
      SELECT DISTINCT usename::text FROM pg_stat_activity WHERE datname = current_database() AND usename IS NOT NULL`;
    const papeis = conexoes.map((item) => item.usename);
    assert.ok(papeis.includes('scv_app'), `papéis conectados: ${papeis.join(', ')}`);
  });

  it('toda tabela com empresaId: a empresa B não vê nenhuma linha da empresa A', async () => {
    const tabelas = await admin.$queryRaw<Array<{ tabela: string }>>`
      SELECT table_name::text AS tabela FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name = 'empresaId' ORDER BY 1`;
    assert.ok(tabelas.length >= 10, `tabelas com empresaId: ${tabelas.length}`);
    const vazamentos: string[] = [];
    const semDados: string[] = [];
    for (const { tabela } of tabelas) {
      const real = await admin.$queryRawUnsafe<Array<{ n: bigint }>>(`SELECT count(*) AS n FROM "${tabela}" WHERE "empresaId" = CAST($1 AS uuid)`, cenario.a.empresaId);
      if (Number(real[0]?.n ?? 0) === 0) semDados.push(tabela);
      const vistoPorB = await comoApp(app, { empresaId: cenario.b.empresaId }, (tx) =>
        tx.$queryRawUnsafe<Array<{ n: bigint }>>(`SELECT count(*) AS n FROM "${tabela}" WHERE "empresaId" = CAST($1 AS uuid)`, cenario.a.empresaId),
      );
      if (Number(vistoPorB[0]?.n ?? 0) > 0) vazamentos.push(tabela);
      const semContexto = await comoApp(app, {}, (tx) =>
        tx.$queryRawUnsafe<Array<{ n: bigint }>>(`SELECT count(*) AS n FROM "${tabela}" WHERE "empresaId" = CAST($1 AS uuid)`, cenario.a.empresaId),
      );
      if (Number(semContexto[0]?.n ?? 0) > 0) vazamentos.push(`${tabela} (sem contexto)`);
    }
    assert.deepEqual(vazamentos, [], `tabelas com vazamento entre empresas: ${vazamentos.join(', ')}`);
    console.log(`  (tabelas com empresaId: ${tabelas.length}; sem dados no cenário: ${semDados.join(', ')})`);
  });

  it('a própria empresa e o admin com MFA (is_admin) enxergam os dados; B não escreve na A', async () => {
    const daA = await comoApp(app, { empresaId: cenario.a.empresaId }, (tx) => tx.vaga.count({ where: { empresaId: cenario.a.empresaId } }));
    assert.equal(daA, 1);
    const adminVe = await comoApp(app, { isAdmin: true }, (tx) => tx.vaga.count());
    assert.equal(adminVe, 2);
    const bVeTotal = await comoApp(app, { empresaId: cenario.b.empresaId }, (tx) => tx.vaga.count());
    assert.equal(bVeTotal, 1);
    await assert.rejects(
      comoApp(app, { empresaId: cenario.b.empresaId }, (tx) =>
        tx.vaga.create({ data: { empresaId: cenario.a.empresaId, titulo: 'invasora', descricao: 'x'.repeat(20), senioridade: 'PLENO', modelo: 'REMOTO' } }),
      ),
      /row-level security|violates/i,
    );
    // UPDATE/DELETE em linha de A sob contexto de B não afeta nada.
    const atualizadas = await comoApp(app, { empresaId: cenario.b.empresaId }, (tx) =>
      tx.vaga.updateMany({ where: { id: cenario.a.vagaId }, data: { titulo: 'sequestrada' } }),
    );
    assert.equal(atualizadas.count, 0);
    const apagadas = await comoApp(app, { empresaId: cenario.b.empresaId }, (tx) => tx.vaga.deleteMany({ where: { id: cenario.a.vagaId } }));
    assert.equal(apagadas.count, 0);
    assert.equal((await admin.vaga.findUniqueOrThrow({ where: { id: cenario.a.vagaId } })).titulo, 'Desenvolvedor backend');
  });
});

