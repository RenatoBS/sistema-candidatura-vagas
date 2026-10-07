import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { UazapiInstanciaCliente } from './uazapi-instancia';

describe('Uazapi instâncias', () => {
  it('usa admintoken no init e token da instância nas demais rotas', async () => {
    const chamadas: Array<{ url: string; headers: Headers; body: string | undefined }> = [];
    const fetchImpl: typeof fetch = async (entrada, init) => {
      chamadas.push({
        url: String(entrada),
        headers: new Headers(init?.headers),
        body: typeof init?.body === 'string' ? init.body : undefined,
      });
      const url = String(entrada);
      if (url.endsWith('/instance/init')) {
        return Response.json({ instance: { id: 'abc', token: 'segredo' }, token: 'segredo' });
      }
      if (url.endsWith('/instance/connect')) {
        return Response.json({ instance: { qrcode: 'data:image/png;base64,aaa', paircode: '1111' } });
      }
      if (url.endsWith('/instance/status')) {
        return Response.json({ instance: { status: 'connected', owner: '5511988887777' }, status: { connected: true } });
      }
      if (url.endsWith('/instance/disconnect')) return new Response(null, { status: 204 });
      if (url.endsWith('/webhook')) return Response.json({ ok: true });
      return new Response('nao', { status: 404 });
    };

    const cliente = new UazapiInstanciaCliente('https://uazapi.test', 'admin-secreto', fetchImpl);
    const criada = await cliente.init('acme');
    assert.equal(criada.id, 'abc');
    assert.equal(criada.token, 'segredo');
    assert.equal(chamadas[0].headers.get('admintoken'), 'admin-secreto');
    assert.equal(chamadas[0].headers.get('token'), null);

    const conexao = await cliente.connect('segredo');
    assert.equal(conexao.qrcode, 'data:image/png;base64,aaa');
    assert.equal(chamadas[1].headers.get('token'), 'segredo');
    assert.equal(chamadas[1].headers.get('admintoken'), null);

    const status = await cliente.status('segredo');
    assert.equal(status.conectada, true);
    assert.equal(status.numero, '5511988887777');

    const urlComSegredo = 'https://api.test/api/v1/webhooks/whatsapp/uazapi/1?segredo=s3gredo';
    await cliente.configurarWebhook('segredo', urlComSegredo);
    assert.match(chamadas[3].body ?? '', /messages/);
    assert.equal((JSON.parse(chamadas[3].body ?? '{}') as { url: string }).url, urlComSegredo);
    await cliente.disconnect('segredo');
    assert.equal(chamadas[4].url.endsWith('/instance/disconnect'), true);
  });
});
