import 'reflect-metadata';

import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { after, before, beforeEach, describe, it } from 'node:test';

import type { INestApplication } from '@nestjs/common';

process.env.NODE_ENV = 'test';
process.env.AUTH_STORE = 'memory';
process.env.JWT_SECRET = 'segredo-de-teste-com-32-bytes!!';
process.env.APP_ENCRYPTION_KEY = randomBytes(32).toString('base64');
process.env.INTERNAL_JOB_TOKEN = 'job-teste';
process.env.LOG_LEVEL = 'silent';

import { limparAmbienteTeste, relogioTeste, repositorioTeste } from '../src/ambiente-teste';
import type { EntrevistaRegistro } from '../src/repositorio/entrevistas-tipos';

const AGORA = new Date('2026-10-10T12:00:00.000Z');
const EMPRESA_ID = '00000000-0000-0000-0000-000000000001';

let app: INestApplication;
let base = '';

async function preparar(status: EntrevistaRegistro['status'] = 'AGUARDANDO_RESPOSTA') {
  const candidaturaId = randomUUID();
  const entrevistaId = randomUUID();
  const etapaId = randomUUID();
  const candidatoId = randomUUID();
  await repositorioTeste.criarCandidatura(
    {
      id: candidaturaId,
      empresaId: EMPRESA_ID,
      vagaId: randomUUID(),
      candidatoId,
      origem: 'DIRETA',
      status: 'TRIAGEM_WHATSAPP',
      statusAntesDaEspera: null,
      etapaAtualId: etapaId,
      criadoEm: new Date(AGORA.getTime() - 48 * 60 * 60 * 1000),
      atualizadoEm: new Date(AGORA.getTime() - 48 * 60 * 60 * 1000),
    },
    {
      id: randomUUID(),
      candidaturaId,
      de: 'INSCRITA',
      para: 'TRIAGEM_WHATSAPP',
      autorId: null,
      motivo: null,
      criadoEm: new Date(AGORA.getTime() - 48 * 60 * 60 * 1000),
    },
    { sistema: true },
  );
  await repositorioTeste.criarEntrevista(
    {
      id: entrevistaId,
      empresaId: EMPRESA_ID,
      candidaturaId,
      etapaId,
      canal: 'WHATSAPP',
      status,
      retryAtual: 0,
      perguntaAtual: 1,
      iniciadaEm: new Date(AGORA.getTime() - 24 * 60 * 60 * 1000),
      ultimaInteracaoEm: new Date(AGORA.getTime() - 24 * 60 * 60 * 1000),
      proximoRetryEm: null,
      aceiteTentativaEm: new Date(AGORA.getTime() - 25 * 60 * 60 * 1000),
      excecaoConcedida: false,
      encerrarAoFim: false,
      criadoEm: new Date(AGORA.getTime() - 48 * 60 * 60 * 1000),
      atualizadoEm: new Date(AGORA.getTime() - 24 * 60 * 60 * 1000),
    },
    { sistema: true },
  );
  await repositorioTeste.guardarResposta({
    id: randomUUID(),
    empresaId: EMPRESA_ID,
    entrevistaId,
    audioUrl: 'audios/resposta.ogg',
    transcricao: 'resposta parcial',
    statusTranscricao: 'CONCLUIDA',
    revisaoHumanaNecessaria: false,
    parcial: false,
  });
  return entrevistaId;
}

async function chamar(entrevistaId: string) {
  const response = await fetch(
    `${base}/interno/triagem/entrevistas/${entrevistaId}/abandonar-inatividade`,
    { method: 'POST', headers: { 'x-internal-token': 'job-teste' } },
  );
  return { status: response.status, json: (await response.json()) as Record<string, unknown> };
}

async function aceitar(entrevistaId: string) {
  const response = await fetch(`${base}/interno/triagem/entrevistas/${entrevistaId}/aceitar`, {
    method: 'POST',
    headers: { 'x-internal-token': 'job-teste' },
  });
  return { status: response.status, json: (await response.json()) as Record<string, unknown> };
}

describe('F7-08 abandono por inatividade', () => {
  before(async () => {
    const { NestFactory } = await import('@nestjs/core');
    const { AppModule } = await import('../src/app.module');
    const { FiltroErros } = await import('../src/http/filtro-erros');
    app = await NestFactory.create(AppModule, { logger: false });
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new FiltroErros());
    await app.listen(0);
    base = `${await app.getUrl()}/api/v1`;
  });

  after(async () => app.close());

  beforeEach(() => {
    limparAmbienteTeste();
    relogioTeste.definir(AGORA);
  });

  it('abandona a entrevista e a candidatura, marca respostas parciais e é idempotente', async () => {
    const entrevistaId = await preparar();
    const primeira = await chamar(entrevistaId);
    assert.equal(primeira.status, 200, JSON.stringify(primeira));
    assert.deepEqual(primeira.json, { abandonada: true, motivo: 'prazo de inatividade vencido' });
    assert.equal(
      (await repositorioTeste.buscarEntrevista(entrevistaId, { sistema: true }))?.status,
      'ABANDONADA',
    );
    const respostas = await repositorioTeste.listarRespostasEntrevista(entrevistaId, {
      sistema: true,
    });
    assert.equal(respostas[0]?.parcial, true);

    const segunda = await chamar(entrevistaId);
    assert.deepEqual(segunda.json, { abandonada: false, motivo: 'já abandonada' });
  });

  it('não abandona antes do prazo nem aceita token interno incorreto', async () => {
    const entrevistaId = await preparar();
    const semToken = await fetch(
      `${base}/interno/triagem/entrevistas/${entrevistaId}/abandonar-inatividade`,
      { method: 'POST' },
    );
    assert.equal(semToken.status, 401);
    relogioTeste.definir(new Date(AGORA.getTime() - 1));
    const resultado = await chamar(entrevistaId);
    assert.equal(resultado.json.abandonada, false, JSON.stringify(resultado));
    assert.equal(
      (await repositorioTeste.buscarEntrevista(entrevistaId, { sistema: true }))?.status,
      'AGUARDANDO_RESPOSTA',
    );
  });

  it('rejeita uma segunda entrevista na mesma candidatura e etapa', async () => {
    const entrevistaId = await preparar();
    const entrevista = await repositorioTeste.buscarEntrevista(entrevistaId, { sistema: true });
    await assert.rejects(
      () => repositorioTeste.criarEntrevista(entrevista!, { sistema: true }),
      (erro: { codigo?: string }) => erro.codigo === 'ENTREVISTA_JA_EXISTE',
    );
  });

  it('registra o aceite sem iniciar a tentativa e bloqueia aceite após a primeira resposta', async () => {
    const entrevistaId = await preparar();
    await repositorioTeste.atualizarEntrevista(
      entrevistaId,
      { status: 'AGUARDANDO_INICIO', iniciadaEm: null, ultimaInteracaoEm: null },
      { sistema: true },
    );
    assert.equal((await aceitar(entrevistaId)).status, 200);
    const aceita = await repositorioTeste.buscarEntrevista(entrevistaId, { sistema: true });
    assert.equal(aceita?.status, 'ACEITE_REGISTRADO');
    assert.equal(aceita?.iniciadaEm, null);

    await repositorioTeste.atualizarEntrevista(
      entrevistaId,
      { iniciadaEm: AGORA, status: 'EM_ANDAMENTO' },
      { sistema: true },
    );
    const repetido = await aceitar(entrevistaId);
    assert.equal(repetido.status, 409);
    assert.equal(repetido.json.codigo, 'TENTATIVA_CONSUMIDA');
  });
});
