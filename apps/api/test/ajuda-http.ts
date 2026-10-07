/**
 * Ajudas compartilhadas dos testes HTTP da correção pós-testes (FC-xx).
 * Importar ESTE módulo antes de `../src/*`: ele fixa o ambiente de teste.
 */
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

process.env.NODE_ENV = 'test';
process.env.AUTH_STORE = 'memory';
process.env.JWT_SECRET = 'segredo-de-teste-com-32-bytes!!';
process.env.APP_ENCRYPTION_KEY = randomBytes(32).toString('base64');
process.env.REVISAO_MANUAL_EMPRESA = 'falha';
process.env.INTERNAL_JOB_TOKEN = 'job-teste';
process.env.API_PUBLIC_URL = 'http://localhost:3000';
process.env.LOG_LEVEL = 'silent';
process.env.LLM_PROVIDER = 'mock';

import { emailTeste, filaCnpjTeste, fonteCnpjTeste } from '../src/ambiente-teste';
import { extrairCodigo } from '../src/auth/segredos';

export * from '../src/ambiente-teste';

export const SENHA = 'senha1234';
export const PRAZO = '2026-11-20T23:59';
export const CNPJ_A = '11222333000181';

export type Json = Record<string, unknown>;

let base = '';
let fechar: () => Promise<void> = async () => {};
let appAtual: { getHttpAdapter(): { getInstance(): unknown } } | null = null;

/** App em execução (para inspecionar as rotas registradas). */
export function appEmExecucao() {
  if (!appAtual) throw new Error('app não iniciado');
  return appAtual;
}

export async function subirApp(): Promise<void> {
  const { NestFactory } = await import('@nestjs/core');
  const { AppModule } = await import('../src/app.module');
  const { FiltroErros } = await import('../src/http/filtro-erros');
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new FiltroErros());
  await app.listen(0);
  appAtual = app;
  base = `${await app.getUrl()}/api/v1`;
  fechar = () => app.close();
}

export async function derrubarApp(): Promise<void> {
  await fechar();
}

export async function api(caminho: string, init: RequestInit = {}, token?: string) {
  const headers = new Headers(init.headers);
  if (token) headers.set('authorization', `Bearer ${token}`);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const resposta = await fetch(`${base}${caminho}`, { ...init, headers });
  const texto = await resposta.text();
  return { status: resposta.status, json: texto ? (JSON.parse(texto) as Json) : {} };
}

export function interno(caminho: string, init: RequestInit = {}) {
  return api(caminho, { method: 'POST', ...init, headers: { 'x-internal-token': 'job-teste', ...(init.headers ?? {}) } });
}

export function payload(token: string): Json {
  return JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8')) as Json;
}

export async function entrar(email: string) {
  const login = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, senha: SENHA }) });
  assert.equal(login.status, 201);
  return { access: String(login.json.accessToken), refresh: String(login.json.refreshToken) };
}

/** Cadastra e confirma e-mail; devolve o access token do primeiro login. */
export async function conta(email: string): Promise<string> {
  assert.equal((await api('/auth/cadastro', { method: 'POST', body: JSON.stringify({ email, senha: SENHA }) })).status, 201);
  const codigo = extrairCodigo(emailTeste.ultimoPara(email)?.texto ?? '');
  assert.ok(codigo);
  await api('/auth/confirmar-email', { method: 'POST', body: JSON.stringify({ token: codigo }) });
  return (await entrar(email)).access;
}

export async function criarEmpresa(access: string, cnpj: string, nome: string) {
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

/** Empresa com e-mail e CNPJ verificados (pode publicar vagas). */
export async function empresaVerificada(access: string, cnpj: string, nome: string) {
  const empresa = await criarEmpresa(access, cnpj, nome);
  const responsavel = `resp-${cnpj.slice(0, 4)}@empresa.test`;
  const codigo = extrairCodigo(emailTeste.ultimoPara(responsavel)?.texto ?? '');
  assert.ok(codigo);
  const email = await api(`/empresas/${empresa.empresaId}/verificacao/email`, { method: 'POST', body: JSON.stringify({ codigo }) }, empresa.token);
  assert.equal(email.status, 201, JSON.stringify(email.json));
  fonteCnpjTeste.definir(cnpj, { situacaoAtiva: true, razaoSocial: `${nome} Ltda`, indisponivel: false });
  assert.equal(filaCnpjTeste.jobs.includes(empresa.empresaId), true);
  assert.equal((await interno(`/interno/empresas/${empresa.empresaId}/verificar-cnpj`)).status, 201);
  return empresa;
}

export interface EtapaCriada {
  id: string;
  ordem: number;
  tipo: string;
}

export async function criarVagaComProcesso(
  empresaId: string,
  token: string,
  etapas: Array<{ tipo: 'TRIAGEM_WHATSAPP' | 'ENTREVISTA_VOZ' | 'REVISAO_HUMANA'; numeroPerguntas: number }>,
) {
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
  const vagaId = String(vaga.json.id);
  const processo = await api(
    `/empresas/${empresaId}/vagas/${vagaId}/processo`,
    { method: 'PUT', body: JSON.stringify({ etapas: etapas.map((etapa, indice) => ({ ordem: indice + 1, ...etapa })) }) },
    token,
  );
  assert.equal(processo.status, 200, JSON.stringify(processo.json));
  return {
    vagaId,
    etapas: (processo.json.processo as { etapas: EtapaCriada[] }).etapas,
  };
}
