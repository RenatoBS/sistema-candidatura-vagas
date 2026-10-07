import assert from 'node:assert/strict';
import { test } from 'node:test';

import { executarAcaoAdmin } from './acao-admin';

test('senha vai só para a reautenticação e nunca no corpo da ação admin', async () => {
  const chamadas: Array<{ caminho: string; init?: RequestInit }> = [];
  const chamar = async <T>(caminho: string, init?: RequestInit): Promise<T> => {
    chamadas.push({ caminho, init });
    return { reauthToken: 'reauth-1' } as T;
  };

  await executarAcaoAdmin(
    { empresaId: 'emp-1', caminho: 'aprovar', senha: 'segredo-123', motivo: 'documentos ok', accessToken: 'tk' },
    chamar,
  );

  assert.equal(chamadas.length, 2);
  assert.equal(chamadas[0]?.caminho, '/auth/reautenticar');
  assert.deepEqual(JSON.parse(String(chamadas[0]?.init?.body)), { senha: 'segredo-123' });
  assert.equal(chamadas[1]?.caminho, '/admin/empresas/emp-1/aprovar');
  const corpoAcao = String(chamadas[1]?.init?.body);
  assert.ok(!corpoAcao.includes('segredo-123'));
  assert.deepEqual(JSON.parse(corpoAcao), { motivo: 'documentos ok' });
  assert.equal(new Headers(chamadas[1]?.init?.headers).get('x-reauth-token'), 'reauth-1');
});
