import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { RepositorioPrisma } from '../src/repositorio/prisma';
import { criarEmpresaEUsuario, criarPrisma, resetarBanco } from './ajuda';

const prisma = criarPrisma();

describe('FC-15 — passo TOTP no Postgres', () => {
  before(() => resetarBanco());
  after(() => prisma.$disconnect());

  it('aceita só passos crescentes e, em corrida, apenas um vence', async () => {
    const { usuario } = await criarEmpresaEUsuario(prisma);
    const repo = new RepositorioPrisma(prisma);
    assert.equal(await repo.consumirPassoMfa(usuario.id, 100), true);
    assert.equal(await repo.consumirPassoMfa(usuario.id, 100), false);
    assert.equal(await repo.consumirPassoMfa(usuario.id, 99), false);
    assert.equal(await repo.consumirPassoMfa(usuario.id, 101), true);

    const corrida = await Promise.all(Array.from({ length: 8 }, () => repo.consumirPassoMfa(usuario.id, 200)));
    assert.equal(corrida.filter(Boolean).length, 1);
    assert.equal((await prisma.usuario.findUniqueOrThrow({ where: { id: usuario.id } })).mfaUltimoPasso, 200);
  });
});
