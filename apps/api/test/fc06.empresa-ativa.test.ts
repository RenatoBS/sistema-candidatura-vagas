import 'reflect-metadata';

import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { after, before, beforeEach, describe, it } from 'node:test';

process.env.NODE_ENV = 'test';
process.env.AUTH_STORE = 'memory';
process.env.JWT_SECRET = 'segredo-de-teste-com-32-bytes!!';
process.env.APP_ENCRYPTION_KEY = randomBytes(32).toString('base64');
process.env.REVISAO_MANUAL_EMPRESA = 'falha';
process.env.INTERNAL_JOB_TOKEN = 'job-teste';
process.env.API_PUBLIC_URL = 'http://localhost:3000';
process.env.LOG_LEVEL = 'silent';
process.env.LLM_PROVIDER = 'mock';

import { emailTeste, limparAmbienteTeste } from '../src/ambiente-teste';
import { extrairCodigo } from '../src/auth/segredos';
import { codigosTotp } from './totp';

const SENHA = 'senha1234';
const PRAZO = '2026-11-20T23:59';

let base = '';
let fechar: () => Promise<void> = async () => {};

type Json = Record<string, unknown>;

async function api(caminho: string, init: RequestInit = {}, token?: string) {
  const headers = new Headers(init.headers);
  if (token) headers.set('authorization', `Bearer ${token}`);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const resposta = await fetch(`${base}${caminho}`, { ...init, headers });
  const texto = await resposta.text();
  return { status: resposta.status, json: texto ? (JSON.parse(texto) as Json) : {} };
}

function payload(token: string): Json {
  return JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8')) as Json;
}

async function entrar(email: string) {
  const login = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, senha: SENHA }) });
  assert.equal(login.status, 201);
  return { access: String(login.json.accessToken), refresh: String(login.json.refreshToken) };
}

async function conta(email: string) {
  assert.equal((await api('/auth/cadastro', { method: 'POST', body: JSON.stringify({ email, senha: SENHA }) })).status, 201);
  const codigo = extrairCodigo(emailTeste.ultimoPara(email)?.texto ?? '');
  assert.ok(codigo);
  await api('/auth/confirmar-email', { method: 'POST', body: JSON.stringify({ token: codigo }) });
  return (await entrar(email)).access;
}

async function criarEmpresa(access: string, cnpj: string, nome: string) {
  const criada = await api(
    '/empresas/cadastro',
    {
      method: 'POST',
      body: JSON.stringify({
        razaoSocial: `${nome} Ltda`,
        nomeFantasia: nome,
        cnpj,
        dominio: 'empresa.test',
        responsavelNome: 'Responsável',
        responsavelEmail: `resp-${cnpj.slice(0, 4)}@empresa.test`,
      }),
    },
    access,
  );
  assert.equal(criada.status, 201, JSON.stringify(criada.json));
  return {
    empresaId: String((criada.json.empresa as { id: string }).id),
    token: String((criada.json.sessao as { accessToken: string }).accessToken),
  };
}

async function criarVaga(empresaId: string, token: string): Promise<string> {
  const vaga = await api(
    `/empresas/${empresaId}/vagas`,
    {
      method: 'POST',
      body: JSON.stringify({
        titulo: 'Desenvolvedor backend',
        descricao: 'APIs em Node.js.',
        senioridade: 'PLENO',
        modelo: 'REMOTO',
        prazoInscricoes: PRAZO,
        habilidades: [{ nome: 'TypeScript', nivelMinimo: 3, peso: 1 }],
      }),
    },
    token,
  );
  assert.equal(vaga.status, 201, JSON.stringify(vaga.json));
  return String(vaga.json.id);
}

describe('FC-06 — empresa ativa na sessão', () => {
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

  after(async () => {
    await fechar();
  });

  beforeEach(() => {
    limparAmbienteTeste();
  });

  it('login de membro de empresa já traz a empresa ativa e libera rotas /vagas/:id/*', async () => {
    const email = 'membro@pessoal.test';
    const empresa = await criarEmpresa(await conta(email), '11222333000181', 'Acme');
    const vagaId = await criarVaga(empresa.empresaId, empresa.token);

    const { access } = await entrar(email);
    assert.equal(payload(access).visao, 'EMPRESA');
    assert.equal(payload(access).empresaId, empresa.empresaId);
    assert.equal((await api(`/vagas/${vagaId}/candidaturas`, {}, access)).status, 200);
    assert.equal((await api(`/vagas/${vagaId}/sugestoes-match`, {}, access)).status, 200);
    const membros = await api(`/empresas/${String((await api('/me', {}, access)).json.empresaAtivaId)}/membros`, {}, access);
    assert.equal(membros.status, 200);
  });

  it('refresh mantém a empresa ativa', async () => {
    const email = 'refresh@pessoal.test';
    const empresa = await criarEmpresa(await conta(email), '11222333000181', 'Acme');
    const { refresh } = await entrar(email);
    const girado = await api('/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken: refresh }) });
    assert.equal(girado.status, 201);
    assert.equal(payload(String(girado.json.accessToken)).empresaId, empresa.empresaId);
  });

  it('PATCH /me/visao persiste a empresa escolhida para login e refresh seguintes', async () => {
    const email = 'duas@pessoal.test';
    const a = await criarEmpresa(await conta(email), '11222333000181', 'Acme');
    const b = await criarEmpresa((await entrar(email)).access, '45997418000153', 'Beta');
    assert.notEqual(a.empresaId, b.empresaId);

    const troca = await api(
      '/me/visao',
      { method: 'PATCH', body: JSON.stringify({ visao: 'EMPRESA', empresaId: a.empresaId }) },
      b.token,
    );
    assert.equal(troca.status, 200, JSON.stringify(troca.json));
    assert.equal(payload(String(troca.json.accessToken)).empresaId, a.empresaId);

    const novo = await entrar(email);
    assert.equal(payload(novo.access).empresaId, a.empresaId);
    const girado = await api('/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken: novo.refresh }) });
    assert.equal(payload(String(girado.json.accessToken)).empresaId, a.empresaId);
  });

  it('visão CANDIDATO não carrega empresa; voltar para EMPRESA sem informar usa a última', async () => {
    const email = 'dual@pessoal.test';
    const empresa = await criarEmpresa(await conta(email), '11222333000181', 'Acme');
    const candidato = await api(
      '/onboarding/candidato',
      { method: 'POST', body: JSON.stringify({ nome: 'Pessoa Teste' }) },
      empresa.token,
    );
    assert.equal(candidato.status, 201);
    assert.equal(payload(String(candidato.json.accessToken)).empresaId, null);
    const volta = await api(
      '/me/visao',
      { method: 'PATCH', body: JSON.stringify({ visao: 'EMPRESA' }) },
      String(candidato.json.accessToken),
    );
    assert.equal(payload(String(volta.json.accessToken)).empresaId, empresa.empresaId);
  });

  it('MFA verificar mantém a empresa ativa', async () => {
    const email = 'mfa@pessoal.test';
    const empresa = await criarEmpresa(await conta(email), '11222333000181', 'Acme');
    const iniciado = await api('/auth/mfa/iniciar', { method: 'POST' }, empresa.token);
    assert.equal(iniciado.status, 201);
    const segredo = new URL(String(iniciado.json.otpauthUrl)).searchParams.get('secret') ?? '';
    const codigo = codigosTotp(segredo);
    assert.equal(
      (await api('/auth/mfa/confirmar', { method: 'POST', body: JSON.stringify({ codigo: codigo() }) }, empresa.token)).status,
      201,
    );
    const { access } = await entrar(email);
    assert.equal(payload(access).empresaId, empresa.empresaId);
    const verificada = await api('/auth/mfa/verificar', { method: 'POST', body: JSON.stringify({ codigo: codigo() }) }, access);
    assert.equal(verificada.status, 201, JSON.stringify(verificada.json));
    const token = String(verificada.json.accessToken);
    assert.equal(payload(token).empresaId, empresa.empresaId);
    assert.equal(payload(token).mfaVerificado, true);
  });
});
