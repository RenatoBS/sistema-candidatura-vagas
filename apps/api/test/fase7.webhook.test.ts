import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { after, before, beforeEach, describe, it } from 'node:test';
process.env.NODE_ENV = 'test';
process.env.AUTH_STORE = 'memory';
process.env.JWT_SECRET = 'segredo-de-teste-com-32-bytes!!';
process.env.APP_ENCRYPTION_KEY = randomBytes(32).toString('base64');
process.env.UAZAPI_WEBHOOK_SECRET = 'segredo-webhook';
process.env.INTERNAL_JOB_TOKEN = 'job-teste';
process.env.LOG_LEVEL = 'silent';
import { cifrar } from '@scv/providers';
import {
  armazenamentoTeste,
  filaWhatsappEntradaTeste,
  limparAmbienteTeste,
  repositorioTeste,
  whatsappMensagensTeste,
} from '../src/ambiente-teste';
let base = '';
let fechar: () => Promise<void> = async () => {};
async function api(path: string, body: unknown, secret = 'segredo-webhook') {
  const response = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-webhook-secret': secret },
    body: JSON.stringify(body),
  });
  return { status: response.status, json: (await response.json()) as Record<string, unknown> };
}
describe('F7-04 webhook Uazapi', () => {
  before(async () => {
    const { NestFactory } = await import('@nestjs/core');
    const { AppModule } = await import('../src/app.module');
    const { FiltroErros } = await import('../src/http/filtro-erros');
    const app = await NestFactory.create(AppModule, { logger: false });
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new FiltroErros());
    await app.listen(0);
    base = `${await app.getUrl()}/api/v1`;
    fechar = () => app.close();
  });
  after(async () => fechar());
  beforeEach(async () => {
    limparAmbienteTeste();
    await repositorioTeste.salvarInstancia(
      {
        id: 'instancia-1',
        empresaId: '00000000-0000-0000-0000-000000000001',
        instanciaIdProvedorCifrado: cifrar('uazapi-1', process.env.APP_ENCRYPTION_KEY!),
        tokenCifrado: cifrar('token-1', process.env.APP_ENCRYPTION_KEY!),
        numero: null,
        status: 'CONECTADA',
        ultimaConexaoEm: null,
        desconectadaEm: null,
      },
      { sistema: true },
    );
  });
  it('rejeita segredo ausente ou errado e aceita uma mensagem apenas uma vez', async () => {
    const sem = await api('/webhooks/whatsapp/uazapi/instancia-1', {}, '');
    assert.equal(sem.status, 401);
    const errado = await api('/webhooks/whatsapp/uazapi/instancia-1', {}, 'errado');
    assert.equal(errado.status, 401);
    const payload = {
      token: 'token-1',
      message: {
        messageid: 'm-1',
        sender: '5511900000001@s.whatsapp.net',
        messageType: 'Conversation',
        text: 'oi',
      },
    };
    const primeiro = await api('/webhooks/whatsapp/uazapi/instancia-1', payload);
    const segundo = await api('/webhooks/whatsapp/uazapi/instancia-1', payload);
    assert.equal(primeiro.status, 201);
    assert.equal(segundo.json.status, 'duplicado');
    assert.equal(filaWhatsappEntradaTeste.jobs.length, 1);
  });
  it('ignora fromMe, API e grupos, e valida instância e token', async () => {
    assert.equal((await api('/webhooks/whatsapp/uazapi/inexistente', {})).status, 404);
    const basePayload = {
      message: {
        messageid: 'm-2',
        sender: '5511900000001@s.whatsapp.net',
        messageType: 'Conversation',
        text: 'oi',
      },
    };
    assert.equal(
      (await api('/webhooks/whatsapp/uazapi/instancia-1', { ...basePayload, token: 'errado' }))
        .status,
      401,
    );
    assert.equal(
      (
        await api('/webhooks/whatsapp/uazapi/instancia-1', {
          ...basePayload,
          message: { ...basePayload.message, fromMe: true },
        })
      ).json.status,
      'ignorado',
    );
    assert.equal(
      (
        await api('/webhooks/whatsapp/uazapi/instancia-1', {
          ...basePayload,
          message: { ...basePayload.message, wasSentByApi: true },
        })
      ).json.status,
      'ignorado',
    );
    assert.equal(
      (
        await api('/webhooks/whatsapp/uazapi/instancia-1', {
          ...basePayload,
          message: { ...basePayload.message, chatid: '123@g.us' },
        })
      ).json.status,
      'ignorado',
    );
  });
  it('processa transcrição pela rota interna protegida e é idempotente', async () => {
    const respostaId = '00000000-0000-4000-8000-000000000001';
    await repositorioTeste.guardarResposta({
      id: respostaId,
      empresaId: '00000000-0000-0000-0000-000000000001',
      entrevistaId: '00000000-0000-4000-8000-000000000002',
      mensagemIdProvedor: 'audio-1',
      audioUrl: null,
      transcricao: null,
      statusTranscricao: 'PENDENTE',
      revisaoHumanaNecessaria: false,
    });
    whatsappMensagensTeste.programarMidia('audio-1', {
      base64: Buffer.from('audio').toString('base64'),
      mimetype: 'audio/ogg',
    });
    const sucesso = await fetch(`${base}/interno/triagem/respostas/${respostaId}/transcrever`, {
      method: 'POST',
      headers: { 'x-internal-token': 'job-teste' },
    });
    assert.equal(sucesso.status, 200);
    const salvo = await repositorioTeste.buscarResposta(respostaId, { sistema: true });
    assert.equal(salvo?.statusTranscricao, 'CONCLUIDA');
    assert.equal(salvo?.confiancaTranscricao, 1);
    assert.equal(salvo?.duracaoSegundos, 1);
    assert.equal((await armazenamentoTeste.ler(String(salvo?.audioUrl)))?.toString(), 'audio');
    const segunda = await fetch(`${base}/interno/triagem/respostas/${respostaId}/transcrever`, {
      method: 'POST',
      headers: { 'x-internal-token': 'job-teste' },
    });
    assert.equal((await segunda.json()).status, 'idempotente');
    const negada = await fetch(`${base}/interno/triagem/respostas/${respostaId}/transcrever`, {
      method: 'POST',
      headers: { 'x-internal-token': 'errado' },
    });
    assert.equal(negada.status, 401);
  });
});
