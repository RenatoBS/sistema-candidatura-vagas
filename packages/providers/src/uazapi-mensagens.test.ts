import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { FakeWhatsappProvider, UazapiProvider } from './whatsapp';

describe('mensagens Uazapi', () => {
  it('envia texto com token e extrai id', async () => {
    let requisicao: RequestInit | undefined;
    const provider = new UazapiProvider('https://uazapi.test', async (_url, init) => {
      requisicao = init;
      return new Response(JSON.stringify({ key: { id: 'm1' } }), { status: 200 });
    });
    assert.deepEqual(
      await provider.enviarTexto({
        token: 'tok',
        numero: '5511900000001',
        texto: 'Olá',
        atrasoMs: 10,
      }),
      { mensagemIdProvedor: 'm1' },
    );
    assert.equal(requisicao?.method, 'POST');
    assert.equal((requisicao?.headers as Record<string, string>).token, 'tok');
    assert.deepEqual(JSON.parse(String(requisicao?.body)), {
      number: '5511900000001',
      text: 'Olá',
      delay: 10,
    });
  });
  it('usa resposta de download e traduz campos', async () => {
    const provider = new UazapiProvider(
      'https://uazapi.test',
      async () =>
        new Response(
          JSON.stringify({ fileURL: 'https://media.test/a.ogg', mimetype: 'audio/ogg' }),
        ),
    );
    assert.deepEqual(await provider.baixarMidia({ token: 'tok', mensagemId: 'm1' }), {
      url: 'https://media.test/a.ogg',
      base64: undefined,
      mimetype: 'audio/ogg',
    });
  });
  it('fake registra, programa mídia e falha sob comando', async () => {
    const fake = new FakeWhatsappProvider();
    const envio = await fake.enviarTexto({ token: 'tok', numero: '5511900000001', texto: 'oi' });
    fake.programarMidia('m1', { base64: 'YQ==', mimetype: 'audio/ogg' });
    assert.equal(fake.enviados.length, 1);
    assert.equal((await fake.baixarMidia({ token: 'tok', mensagemId: 'm1' })).base64, 'YQ==');
    fake.falhar = true;
    await assert.rejects(
      () => fake.enviarTexto({ token: 'tok', numero: '1', texto: 'x' }),
      /UAZAPI_FALHA_FAKE/,
    );
    assert.match(envio.mensagemIdProvedor, /^fake-/);
  });
});
