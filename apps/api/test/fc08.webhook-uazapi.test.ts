import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import { after, before, beforeEach, describe, it } from 'node:test';

import './ajuda-http';

import { lerConfiguracao } from '../src/configuracao';
import { opcoesLogger, redigirUrl } from '../src/logger';
import { urlWebhookUazapi } from '../src/whatsapp/webhook-url';
import { api, CNPJ_A, conta, derrubarApp, empresaVerificada, interno, limparAmbienteTeste, subirApp, whatsappTeste } from './ajuda-http';

describe('FC-08 — webhook da Uazapi', () => {
  before(async () => {
    process.env.UAZAPI_WEBHOOK_SECRET = 'segredo-webhook';
    await subirApp();
  });
  after(derrubarApp);
  beforeEach(limparAmbienteTeste);

  it('a URL registrada na Uazapi é pública e carrega o segredo', async () => {
    const empresa = await empresaVerificada(await conta('fc08@pessoal.test'), CNPJ_A, 'Acme');
    const criada = await api(`/empresas/${empresa.empresaId}/whatsapp/instancia`, { method: 'POST' }, empresa.token);
    assert.ok(criada.status < 300, JSON.stringify(criada.json));
    const conectar = await api(`/empresas/${empresa.empresaId}/whatsapp/conectar`, { method: 'POST' }, empresa.token);
    assert.ok(conectar.status < 300, JSON.stringify(conectar.json));
    whatsappTeste.conectadas.add(String(conectar.json.qrcode).replace(/^qr:/, ''));
    const monitor = await interno('/interno/triagem/monitorar');
    assert.ok(monitor.status < 300, JSON.stringify(monitor.json));
    assert.ok(whatsappTeste.webhooks.length >= 1, 'webhook não foi registrado');
    const { url } = whatsappTeste.webhooks[0]!;
    assert.match(url, /^http:\/\/localhost:3000\/api\/v1\/webhooks\/whatsapp\/uazapi\/[^/?]+\?segredo=segredo-webhook$/);
  });

  it('monta a URL com segredo codificado e sem barras duplicadas', () => {
    assert.equal(
      urlWebhookUazapi('https://api.exemplo.com.br/', 'i-1', 'a b&c'),
      'https://api.exemplo.com.br/api/v1/webhooks/whatsapp/uazapi/i-1?segredo=a%20b%26c',
    );
  });

  it('webhook aceita o segredo pela query (2xx de autenticação) e rejeita sem segredo (401)', async () => {
    const semSegredo = await api('/webhooks/whatsapp/uazapi/00000000-0000-0000-0000-000000000000', { method: 'POST', body: '{}' });
    assert.equal(semSegredo.status, 401);
    const errado = await api('/webhooks/whatsapp/uazapi/00000000-0000-0000-0000-000000000000?segredo=errado', { method: 'POST', body: '{}' });
    assert.equal(errado.status, 401);
    // Segredo correto passa da autenticação: instância inexistente vira 404, não 401.
    const certo = await api('/webhooks/whatsapp/uazapi/00000000-0000-0000-0000-000000000000?segredo=segredo-webhook', { method: 'POST', body: '{}' });
    assert.equal(certo.status, 404);
    const porHeader = await api('/webhooks/whatsapp/uazapi/00000000-0000-0000-0000-000000000000', {
      method: 'POST',
      body: '{}',
      headers: { 'x-webhook-secret': 'segredo-webhook' },
    });
    assert.equal(porHeader.status, 404);
  });
});

describe('FC-08 — configuração', () => {
  const base = { NODE_ENV: 'production', JWT_SECRET: 'segredo-de-teste-com-32-bytes!!' } as NodeJS.ProcessEnv;

  it('exige UAZAPI_WEBHOOK_SECRET quando a Uazapi está configurada', () => {
    assert.throws(
      () => lerConfiguracao({ ...base, API_PUBLIC_URL: 'https://api.exemplo.com.br', UAZAPI_BASE_URL: 'https://u.test', UAZAPI_ADMIN_TOKEN: 'x' }),
      /UAZAPI_WEBHOOK_SECRET/,
    );
    assert.doesNotThrow(() =>
      lerConfiguracao({
        ...base,
        API_PUBLIC_URL: 'https://api.exemplo.com.br',
        UAZAPI_BASE_URL: 'https://u.test',
        UAZAPI_ADMIN_TOKEN: 'x',
        UAZAPI_WEBHOOK_SECRET: 's',
      }),
    );
  });

  it('API_PUBLIC_URL não pode ser localhost fora de desenvolvimento', () => {
    for (const url of ['http://localhost:3000', 'http://127.0.0.1:3000', 'https://api.localhost']) {
      assert.throws(() => lerConfiguracao({ ...base, API_PUBLIC_URL: url }), /localhost/);
    }
    assert.throws(() => lerConfiguracao({ ...base, API_PUBLIC_URL: 'não é url' }), /URL/);
    assert.doesNotThrow(() => lerConfiguracao({ ...base, NODE_ENV: 'development', API_PUBLIC_URL: 'http://localhost:3000' }));
  });
});

describe('FC-04/FC-08 — logs sem segredos', () => {
  it('headers sensíveis e o segredo da query não aparecem no log capturado', async () => {
    const { default: pinoHttp } = await import('pino-http');
    const { createServer } = await import('node:http');
    const linhas: string[] = [];
    const destino = new Writable({
      write(chunk: Buffer, _enc, cb) {
        linhas.push(chunk.toString());
        cb();
      },
    });
    // Mesmas opções que o AppModule entrega ao nestjs-pino.
    const middleware = pinoHttp(opcoesLogger({ LOG_LEVEL: 'info' }), destino);
    const servidor = createServer((req, res) => {
      middleware(req, res);
      res.end('ok');
    });
    await new Promise<void>((ok) => servidor.listen(0, ok));
    const porta = (servidor.address() as { port: number }).port;
    const valores = ['tok-interno-123', 'reauth-456', 'webhook-789', 'Bearer jwt-abc', 'cookie-def', 'tok-uazapi-ghi', 'segredo-na-query-jkl'];
    await fetch(`http://localhost:${porta}/x?segredo=${valores[6]}`, {
      headers: {
        'x-internal-token': valores[0]!,
        'x-reauth-token': valores[1]!,
        'x-webhook-secret': valores[2]!,
        authorization: valores[3]!,
        cookie: valores[4]!,
        token: valores[5]!,
      },
    });
    await new Promise((ok) => setTimeout(ok, 50));
    await new Promise((ok) => servidor.close(ok));
    const saida = linhas.join('');
    assert.ok(saida.includes('"url"'), 'log da requisição não foi emitido');
    for (const valor of valores) assert.equal(saida.includes(valor.replace('Bearer ', '')), false, `vazou ${valor}`);
  });

  it('redigirUrl mascara só parâmetros secretos', () => {
    assert.equal(redigirUrl('/a?segredo=abc&x=1'), '/a?segredo=[Redacted]&x=1');
    assert.equal(redigirUrl('/a?x=1'), '/a?x=1');
  });
});
