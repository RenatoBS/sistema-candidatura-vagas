import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import { RepositorioMemoria } from '../src/repositorio/memoria';
import { RepositorioPrisma } from '../src/repositorio/prisma';
import type { Repositorio } from '../src/repositorio/tipos';
import { criarEmpresaEUsuario, criarPrisma, resetarBanco } from './ajuda';

const prisma = criarPrisma();

describe('FC-13 — alertas de WhatsApp na central (Prisma)', () => {
  before(() => resetarBanco());
  after(() => prisma.$disconnect());

  it('WHATSAPP_DESCONECTADO e OPERACIONAL gravados sem `central` aparecem na central da empresa', async () => {
    const { empresa, usuario } = await criarEmpresaEUsuario(prisma);
    const repo: Repositorio = new RepositorioPrisma(prisma);
    const ctx = { empresaId: empresa.id, sistema: true };
    for (const tipo of ['WHATSAPP_DESCONECTADO', 'OPERACIONAL'] as const) {
      await repo.inserirNotificacaoUnica(
        { id: randomUUID(), usuarioId: usuario.id, empresaId: empresa.id, tipo, chaveDedup: `${tipo}:${empresa.id}`, dados: { empresaId: empresa.id }, criadoEm: new Date() },
        ctx,
      );
    }
    // Notificação de preferência desligada (central: false) continua fora.
    await repo.inserirNotificacaoUnica(
      { id: randomUUID(), usuarioId: usuario.id, empresaId: empresa.id, tipo: 'CANDIDATO_NOVO', chaveDedup: `CN:${empresa.id}`, dados: { central: false }, criadoEm: new Date() },
      ctx,
    );
    const pagina = await repo.listarNotificacoes({ usuarioId: usuario.id, empresaId: empresa.id, pagina: 1, limite: 20 }, ctx);
    assert.deepEqual(pagina.itens.map((item) => item.tipo).sort(), ['OPERACIONAL', 'WHATSAPP_DESCONECTADO']);
    assert.equal(pagina.naoLidas, 2);
  });
});

describe('FC-13 — alertas de WhatsApp na central (memória)', () => {
  it('mesmo contrato do repositório em memória', async () => {
    const repo = new RepositorioMemoria();
    const empresaId = randomUUID();
    const usuarioId = randomUUID();
    await repo.inserirNotificacaoUnica(
      { id: randomUUID(), usuarioId, empresaId, tipo: 'WHATSAPP_DESCONECTADO', chaveDedup: 'a', dados: { empresaId }, criadoEm: new Date() },
      { empresaId, sistema: true },
    );
    const pagina = await repo.listarNotificacoes({ usuarioId, empresaId, pagina: 1, limite: 20 }, { empresaId });
    assert.equal(pagina.itens.length, 1);
  });
});
