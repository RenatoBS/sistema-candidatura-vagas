import assert from 'node:assert/strict';
import test from 'node:test';
import { DeviceNotRegisteredError, ExpoPushProvider, MockPushProvider, criarPushProvider } from './push';

test('push', async (t) => {
  await t.test('mock é padrão e registra envios em memória', async () => {
    const provider = criarPushProvider({ NODE_ENV: 'test' });
    assert.ok(provider instanceof MockPushProvider);
    await provider.enviar({ token: 'ExponentPushToken[test]', titulo: 'Olá', corpo: 'Teste' });
    assert.equal(provider.enviados.length, 1);
  });

  await t.test('Expo usa bearer opcional e remove DeviceNotRegistered', async () => {
    let requisicao: RequestInit | undefined;
    const provider = new ExpoPushProvider('segredo', async (_url, init) => {
      requisicao = init;
      return new Response(JSON.stringify({ data: { details: { error: 'DeviceNotRegistered' } } }), { status: 200 });
    });
    await assert.rejects(() => provider.enviar({ token: 'tok', titulo: 'T', corpo: 'C' }), DeviceNotRegisteredError);
    assert.equal((requisicao?.headers as Record<string, string>).authorization, 'Bearer segredo');
  });
});
