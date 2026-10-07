import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { avaliarPapelDeRuntime } from '../src/repositorio/papel-runtime';

describe('FC-03 — papel de runtime do banco', () => {
  it('scv_app (sem superuser, sem BYPASSRLS) está ok', () => {
    assert.equal(avaliarPapelDeRuntime({ usuario: 'scv_app', rolsuper: false, rolbypassrls: false }, 'production').nivel, 'ok');
  });

  it('superuser ou BYPASSRLS impede o boot em produção e avisa fora dela', () => {
    for (const papel of [
      { usuario: 'scv', rolsuper: true, rolbypassrls: true },
      { usuario: 'x', rolsuper: false, rolbypassrls: true },
      { usuario: 'y', rolsuper: true, rolbypassrls: false },
    ]) {
      const prod = avaliarPapelDeRuntime(papel, 'production');
      assert.equal(prod.nivel, 'erro');
      assert.match(prod.mensagem, /RLS não protege/);
      assert.equal(avaliarPapelDeRuntime(papel, 'development').nivel, 'aviso');
      assert.equal(avaliarPapelDeRuntime(papel, undefined).nivel, 'aviso');
    }
  });
});
