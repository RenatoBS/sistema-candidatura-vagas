import 'reflect-metadata';

import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { after, before, beforeEach, describe, it } from 'node:test';
import { cifrar } from '@scv/providers';

process.env.NODE_ENV = 'test';
process.env.AUTH_STORE = 'memory';
process.env.JWT_SECRET = 'segredo-de-teste-com-32-bytes!!';
process.env.APP_ENCRYPTION_KEY = randomBytes(32).toString('base64');
process.env.UAZAPI_WEBHOOK_SECRET = 'segredo-webhook';
process.env.INTERNAL_JOB_TOKEN = 'job-teste';
process.env.STT_LIMIAR_CONFIANCA = '0.6';
process.env.LOG_LEVEL = 'silent';

import {
  armazenamentoTeste,
  limparAmbienteTeste,
  repositorioTeste,
  sttTeste,
  whatsappMensagensTeste,
} from '../src/ambiente-teste';

let base = '';
let fechar: () => Promise<void> = async () => {};

const EMPRESA_ID = '00000000-0000-0000-0000-000000000001';
const ENTREVISTA_ID = '00000000-0000-4000-8000-000000000002';

async function transcrever(respostaId: string, token?: string) {
  const headers: Record<string, string> = {};
  if (token !== undefined) headers['x-internal-token'] = token;
  const response = await fetch(`${base}/interno/triagem/respostas/${respostaId}/transcrever`, {
    method: 'POST',
    headers,
  });
  return { status: response.status, json: (await response.json()) as Record<string, unknown> };
}

async function falhar(respostaId: string) {
  const response = await fetch(`${base}/interno/triagem/respostas/${respostaId}/falha`, {
    method: 'POST',
    headers: { 'x-internal-token': 'job-teste' },
  });
  return { status: response.status, json: (await response.json()) as Record<string, unknown> };
}

async function prepararResposta(id: string) {
  await repositorioTeste.guardarResposta({
    id,
    empresaId: EMPRESA_ID,
    entrevistaId: ENTREVISTA_ID,
    mensagemIdProvedor: `audio-${id}`,
    audioUrl: null,
    transcricao: null,
    statusTranscricao: 'PENDENTE',
    revisaoHumanaNecessaria: false,
  });
  whatsappMensagensTeste.programarMidia(`audio-${id}`, {
    base64: Buffer.from('audio de teste').toString('base64'),
    mimetype: 'audio/ogg',
  });
}

describe('F7-09 transcrição de áudio por HTTP', () => {
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
        id: 'instancia-transcricao',
        empresaId: EMPRESA_ID,
        instanciaIdProvedorCifrado: cifrar('uazapi-1', process.env.APP_ENCRYPTION_KEY!),
        tokenCifrado: cifrar('token-1', process.env.APP_ENCRYPTION_KEY!),
        numero: '5511900000001',
        status: 'CONECTADA',
        ultimaConexaoEm: null,
        desconectadaEm: null,
      },
      { sistema: true },
    );
  });

  it('rejeita token interno ausente ou incorreto', async () => {
    const respostaId = '00000000-0000-4000-8000-000000000101';
    assert.equal((await transcrever(respostaId)).status, 401);
    assert.equal((await transcrever(respostaId, 'errado')).status, 401);
  });

  it('baixa, armazena, transcreve e grava os metadados esperados', async () => {
    const respostaId = '00000000-0000-4000-8000-000000000102';
    await prepararResposta(respostaId);

    const resultado = await transcrever(respostaId, 'job-teste');
    assert.equal(resultado.status, 200);
    assert.deepEqual(resultado.json, { status: 'concluida' });

    const salvo = await repositorioTeste.buscarResposta(respostaId, { sistema: true });
    const key = `empresas/${EMPRESA_ID}/entrevistas/${ENTREVISTA_ID}/respostas/${respostaId}.ogg`;
    assert.equal(salvo?.audioUrl, key);
    assert.equal((await armazenamentoTeste.ler(key))?.toString(), 'audio de teste');
    assert.equal(salvo?.transcricao, 'resposta de teste');
    assert.equal(salvo?.duracaoSegundos, 1);
    assert.equal(salvo?.confiancaTranscricao, 1);
    assert.equal(salvo?.statusTranscricao, 'CONCLUIDA');
    assert.equal(salvo?.revisaoHumanaNecessaria, false);
  });

  it('marca revisão humana quando a confiança fica abaixo do limiar configurado', async () => {
    const respostaId = '00000000-0000-4000-8000-000000000103';
    await prepararResposta(respostaId);
    sttTeste.confianca = 0.59;

    assert.equal((await transcrever(respostaId, 'job-teste')).status, 200);
    const salvo = await repositorioTeste.buscarResposta(respostaId, { sistema: true });
    assert.equal(salvo?.statusTranscricao, 'CONCLUIDA');
    assert.equal(salvo?.revisaoHumanaNecessaria, true);
  });

  it('volta a resposta para PENDENTE quando o download ou o STT falha', async () => {
    const semMidia = '00000000-0000-4000-8000-000000000104';
    await repositorioTeste.guardarResposta({
      id: semMidia,
      empresaId: EMPRESA_ID,
      entrevistaId: ENTREVISTA_ID,
      mensagemIdProvedor: 'audio-inexistente',
      audioUrl: null,
      transcricao: null,
      statusTranscricao: 'PENDENTE',
    });
    assert.equal((await transcrever(semMidia, 'job-teste')).status, 500);
    assert.equal(
      (await repositorioTeste.buscarResposta(semMidia, { sistema: true }))?.statusTranscricao,
      'PENDENTE',
    );

    const sttFalha = '00000000-0000-4000-8000-000000000105';
    await prepararResposta(sttFalha);
    sttTeste.falhar = true;
    assert.equal((await transcrever(sttFalha, 'job-teste')).status, 500);
    assert.equal(
      (await repositorioTeste.buscarResposta(sttFalha, { sistema: true }))?.statusTranscricao,
      'PENDENTE',
    );
  });

  it('marca falha e revisão humana pela rota de esgotamento', async () => {
    const respostaId = '00000000-0000-4000-8000-000000000106';
    await prepararResposta(respostaId);

    const resultado = await falhar(respostaId);
    assert.equal(resultado.status, 200);
    assert.deepEqual(resultado.json, { status: 'falha' });
    const salvo = await repositorioTeste.buscarResposta(respostaId, { sistema: true });
    assert.equal(salvo?.statusTranscricao, 'FALHA');
    assert.equal(salvo?.revisaoHumanaNecessaria, true);
  });

  it('retorna 404 para resposta inexistente e não chama STT duas vezes', async () => {
    assert.equal(
      (await transcrever('00000000-0000-4000-8000-000000000107', 'job-teste')).status,
      404,
    );

    const respostaId = '00000000-0000-4000-8000-000000000108';
    await prepararResposta(respostaId);
    assert.equal((await transcrever(respostaId, 'job-teste')).status, 200);
    assert.equal((await transcrever(respostaId, 'job-teste')).json.status, 'idempotente');
    assert.equal(sttTeste.chamadas, 1);
  });
});
