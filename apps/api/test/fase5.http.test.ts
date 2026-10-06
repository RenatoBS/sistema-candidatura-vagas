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

import { criarDepsOcrMock, executarJobCurriculo } from '@scv/providers';

import { pdfComTexto } from '../../../packages/providers/src/fixtures/gerar';
import { armazenamentoTeste, emailTeste, limparAmbienteTeste } from '../src/ambiente-teste';
import { extrairCodigo } from '../src/auth/segredos';

const MIME_PDF = 'application/pdf';
const MIME_PNG = 'image/png';

let base = '';
let fechar: () => Promise<void> = async () => {};

async function api(caminho: string, init: RequestInit = {}, token?: string) {
  const headers = new Headers(init.headers);
  if (token) headers.set('authorization', `Bearer ${token}`);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const resposta = await fetch(`${base}${caminho}`, { ...init, headers });
  const texto = await resposta.text();
  return { status: resposta.status, json: texto ? (JSON.parse(texto) as Record<string, unknown>) : {} };
}

async function registrar(email: string) {
  const senha = 'senha1234';
  const cadastro = await api('/auth/cadastro', { method: 'POST', body: JSON.stringify({ email, senha }) });
  assert.equal(cadastro.status, 201);
  const codigo = extrairCodigo(emailTeste.ultimoPara(email)?.texto ?? '');
  assert.ok(codigo);
  await api('/auth/confirmar-email', { method: 'POST', body: JSON.stringify({ token: codigo }) });
  const login = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, senha }) });
  assert.equal(login.status, 201);
  const onboard = await api(
    '/onboarding/candidato',
    { method: 'POST', body: JSON.stringify({ nome: 'João Candidato' }) },
    String(login.json.accessToken),
  );
  assert.equal(onboard.status, 201);
  return { senha, access: String(onboard.json.accessToken) };
}

function pngMarcado(texto: string): Buffer {
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from(`SCVTEXT:${texto}\0`),
  ]);
}

async function publicar(access: string, corpo: Buffer, mime: string) {
  const pedido = await api(
    '/curriculos/upload-url',
    { method: 'POST', body: JSON.stringify({ mimeType: mime, tamanhoBytes: corpo.length }) },
    access,
  );
  assert.equal(pedido.status, 201);
  const envio = await fetch(String(pedido.json.url), {
    method: 'PUT',
    headers: pedido.json.headers as HeadersInit,
    body: corpo,
  });
  assert.equal(envio.status, 200);
  const registro = await api(
    '/curriculos',
    {
      method: 'POST',
      body: JSON.stringify({ arquivoKey: pedido.json.arquivoKey, mimeType: mime, tamanhoBytes: corpo.length }),
    },
    access,
  );
  assert.equal(registro.status, 201);
  const id = String(registro.json.id);
  await executarJobCurriculo(id, {
    baseUrl: base,
    token: 'job-teste',
    storage: armazenamentoTeste,
    deps: criarDepsOcrMock(),
  });
  return api(`/curriculos/${id}`, {}, access);
}

describe('Fase 5 — perfil, currículo e LGPD', () => {
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

  it('rejeita LinkedIn inválido e grava o válido sem chamar a rede', async () => {
    const conta = await registrar('perfil@pessoal.test');
    const invalido = await api(
      '/candidatos/me',
      { method: 'PUT', body: JSON.stringify({ linkedinUrl: 'https://www.linkedin.com/company/acme' }) },
      conta.access,
    );
    assert.equal(invalido.status, 400);
    assert.equal(invalido.json.codigo, 'LINKEDIN_INVALIDO');
    const valido = await api(
      '/candidatos/me',
      {
        method: 'PUT',
        body: JSON.stringify({
          linkedinUrl: 'https://www.linkedin.com/in/joao-candidato/',
          visivelParaMatch: false,
          whatsapp: '+55 11 98888-7777',
        }),
      },
      conta.access,
    );
    assert.equal(valido.status, 200);
    assert.equal(valido.json.linkedinUrl, 'https://www.linkedin.com/in/joao-candidato');
    assert.equal(valido.json.visivelParaMatch, false);
    assert.equal(valido.json.whatsapp, '+5511988887777');
    assert.equal('score' in valido.json, false);
  });

  it('não copia dados extraídos para o perfil antes da confirmação', async () => {
    const conta = await registrar('cv@pessoal.test');
    const antes = await api('/candidatos/me', {}, conta.access);
    assert.deepEqual(antes.json.perfil, {});
    const pdf = await pdfComTexto('Engenheira TypeScript PostgreSQL com experiencia');
    const pronto = await publicar(conta.access, pdf, MIME_PDF);
    assert.equal(pronto.status, 200);
    assert.equal(pronto.json.metodoExtracao, 'NATIVO');
    assert.equal(pronto.json.baixaConfianca, false);
    assert.match(String(pronto.json.textoExtraido), /TypeScript/);
    const meio = await api('/candidatos/me', {}, conta.access);
    assert.equal((meio.json.perfil as { resumo?: string }).resumo, undefined);
    const cedo = await api(`/curriculos/${String(pronto.json.id)}/confirmar`, { method: 'POST', body: '{}' }, conta.access);
    assert.equal(cedo.status, 200);
    const depois = await api('/candidatos/me', {}, conta.access);
    assert.match(String((depois.json.perfil as { resumo?: string }).resumo), /TypeScript/);
    const habilidades = await api('/candidatos/me/habilidades', {}, conta.access);
    const selecionadas = habilidades.json.selecionadas as { nome: string; origem: string }[];
    assert.ok(selecionadas.some((item) => item.nome === 'TypeScript' && item.origem === 'CV_EXTRAIDO'));
  });

  it('imagem passa por OCR e arquivo infectado é recusado', async () => {
    const conta = await registrar('ocr@pessoal.test');
    const imagem = await publicar(conta.access, pngMarcado('Analista TypeScript'), MIME_PNG);
    assert.equal(imagem.json.metodoExtracao, 'OCR');
    assert.match(String(imagem.json.textoExtraido), /TypeScript/);
    const outro = await registrar('outro@pessoal.test');
    const negado = await api(`/curriculos/${String(imagem.json.id)}`, {}, outro.access);
    assert.equal(negado.status, 404);

    const pdf = Buffer.concat([
      await pdfComTexto('Curriculo de teste com texto'),
      Buffer.from('EICAR-STANDARD-ANTIVIRUS-TEST-FILE'),
    ]);
    const pedido = await api(
      '/curriculos/upload-url',
      { method: 'POST', body: JSON.stringify({ mimeType: MIME_PDF, tamanhoBytes: pdf.length }) },
      conta.access,
    );
    await fetch(String(pedido.json.url), { method: 'PUT', body: pdf });
    const infectado = await api(
      '/curriculos',
      {
        method: 'POST',
        body: JSON.stringify({ arquivoKey: pedido.json.arquivoKey, mimeType: MIME_PDF, tamanhoBytes: pdf.length }),
      },
      conta.access,
    );
    assert.equal(infectado.status, 422);
    assert.equal(infectado.json.codigo, 'ARQUIVO_INFECTADO');
    const grande = await api(
      '/curriculos/upload-url',
      { method: 'POST', body: JSON.stringify({ mimeType: MIME_PDF, tamanhoBytes: 9 * 1024 * 1024 }) },
      conta.access,
    );
    assert.equal(grande.status, 400);
    assert.equal(grande.json.codigo, 'TAMANHO_INVALIDO');
  });

  it('registra consentimentos e exporta sem ranking; exclusão anonimiza', async () => {
    const conta = await registrar('lgpd@pessoal.test');
    const termos = await api(
      '/candidatos/me/consentimentos',
      { method: 'POST', body: JSON.stringify({ tipo: 'TERMOS', concedido: true, versaoTermo: '2026-10-06' }) },
      conta.access,
    );
    assert.equal(termos.status, 201);
    await api(
      '/candidatos/me/consentimentos',
      { method: 'POST', body: JSON.stringify({ tipo: 'WHATSAPP', concedido: false, versaoTermo: '2026-10-06' }) },
      conta.access,
    );
    const lista = await api('/candidatos/me/consentimentos', {}, conta.access);
    const tipos = lista.json as { tipo: string; concedido: boolean }[];
    assert.equal(tipos.find((item) => item.tipo === 'WHATSAPP')?.concedido, false);
    const pdf = await pdfComTexto('Pessoa desenvolvedora TypeScript');
    await publicar(conta.access, pdf, MIME_PDF);
    const exportacao = await api('/lgpd/exportar', { method: 'POST' }, conta.access);
    assert.equal(exportacao.status, 200);
    assert.equal(JSON.stringify(exportacao.json).includes('"score"'), false);
    assert.match(JSON.stringify(exportacao.json), /TypeScript/);
    const reauth = await api('/auth/reautenticar', { method: 'POST', body: JSON.stringify({ senha: conta.senha }) }, conta.access);
    assert.equal(reauth.status, 201);
    const exclusao = await api(
      '/lgpd/excluir',
      {
        method: 'POST',
        headers: { 'x-reauth-token': String(reauth.json.reauthToken) },
        body: JSON.stringify({ confirmacao: 'EXCLUIR' }),
      },
      conta.access,
    );
    assert.equal(exclusao.status, 200);
    const perfil = await api('/candidatos/me', {}, conta.access);
    assert.equal(perfil.json.nome, 'Titular excluído');
    assert.equal(perfil.json.linkedinUrl, null);
    const curriculos = await api('/curriculos', {}, conta.access);
    assert.deepEqual(curriculos.json, []);
  });
});
