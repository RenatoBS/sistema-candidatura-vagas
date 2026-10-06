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

import { emailTeste, filaCnpjTeste, fonteCnpjTeste, limparAmbienteTeste, repositorioTeste, whatsappTeste } from '../src/ambiente-teste';
import { codigoTotp, extrairCodigo, extrairToken } from '../src/auth/segredos';

const CNPJ = '11222333000181';

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
  const cadastro = await api('/auth/cadastro', {
    method: 'POST',
    body: JSON.stringify({ email, senha }),
  });
  assert.equal(cadastro.status, 201);
  const codigo = extrairCodigo(emailTeste.ultimoPara(email)?.texto ?? '');
  assert.ok(codigo);
  const confirmacao = await api('/auth/confirmar-email', {
    method: 'POST',
    body: JSON.stringify({ token: codigo }),
  });
  assert.equal(confirmacao.status, 201);
  const login = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, senha }) });
  assert.equal(login.status, 201);
  return { senha, access: String(login.json.accessToken), refresh: String(login.json.refreshToken) };
}

describe('Fase 3 — auth, papéis, empresa e WhatsApp', () => {
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

  it('cadastra, confirma e-mail, faz login, refresh rotativo e logout', async () => {
    const conta = await registrar('ana@pessoal.test');
    const me = await api('/me', {}, conta.access);
    assert.equal(me.status, 200);
    assert.equal(me.json.emailConfirmado, true);
    const girado = await api('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: conta.refresh }),
    });
    assert.equal(girado.status, 201);
    const reuso = await api('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: conta.refresh }),
    });
    assert.equal(reuso.status, 401);
    assert.equal(reuso.json.codigo, 'REFRESH_REUTILIZADO');
    const depois = await api('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: girado.json.refreshToken }),
    });
    assert.equal(depois.status, 401);
    const logout = await api('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: String(girado.json.refreshToken) }),
    });
    assert.equal(logout.status, 201);
  });

  it('não revela se o e-mail existe na recuperação', async () => {
    const resposta = await api('/auth/recuperar', {
      method: 'POST',
      body: JSON.stringify({ email: 'ninguem@teste.com' }),
    });
    assert.equal(resposta.status, 201);
    assert.equal(resposta.json.ok, true);
  });

  it('empresa pendente não publica e fica verificada quando as checagens passam', async () => {
    const conta = await registrar('dona@acme.com.br');
    const criada = await api(
      '/empresas/cadastro',
      {
        method: 'POST',
        body: JSON.stringify({
          razaoSocial: 'Acme Ltda',
          nomeFantasia: 'Acme',
          cnpj: '11.222.333/0001-81',
          dominio: 'acme.com.br',
          responsavelNome: 'Ana',
          responsavelEmail: 'ana@acme.com.br',
        }),
      },
      conta.access,
    );
    assert.equal(criada.status, 201);
    const empresaId = String((criada.json.empresa as { id: string }).id);
    const accessEmpresa = String((criada.json.sessao as { accessToken: string }).accessToken);
    assert.equal((criada.json.empresa as { statusVerificacao: string }).statusVerificacao, 'PENDENTE');

    const bloqueio = await api(`/empresas/${empresaId}/vagas/publicar`, { method: 'POST' }, accessEmpresa);
    assert.equal(bloqueio.status, 403);
    assert.equal(bloqueio.json.codigo, 'EMPRESA_NAO_VERIFICADA');

    const codigo = extrairCodigo(emailTeste.ultimoPara('ana@acme.com.br')?.texto ?? '');
    assert.ok(codigo);
    const emailOk = await api(
      `/empresas/${empresaId}/verificacao/email`,
      { method: 'POST', body: JSON.stringify({ codigo }) },
      accessEmpresa,
    );
    assert.equal(emailOk.status, 201);
    assert.equal(filaCnpjTeste.jobs.includes(empresaId), true);

    fonteCnpjTeste.definir(CNPJ, { situacaoAtiva: true, razaoSocial: 'Acme Ltda', indisponivel: false });
    const job = await api(`/interno/empresas/${empresaId}/verificar-cnpj`, {
      method: 'POST',
      headers: { 'x-internal-token': 'job-teste' },
    });
    assert.equal(job.status, 201);
    assert.equal(job.json.statusVerificacao, 'VERIFICADA');

    const publicar = await api(`/empresas/${empresaId}/vagas/publicar`, { method: 'POST' }, accessEmpresa);
    assert.equal(publicar.status, 201);
    assert.equal(publicar.json.permitido, true);
  });

  it('CNPJ divergente cai na fila e o admin sem MFA não aprova', async () => {
    const dona = await registrar('dona2@acme.com.br');
    const criada = await api(
      '/empresas/cadastro',
      {
        method: 'POST',
        body: JSON.stringify({
          razaoSocial: 'Nome Errado',
          nomeFantasia: 'Acme',
          cnpj: CNPJ,
          dominio: 'acme.com.br',
          responsavelNome: 'Ana',
          responsavelEmail: 'financeiro@acme.com.br',
        }),
      },
      dona.access,
    );
    const empresaId = String((criada.json.empresa as { id: string }).id);
    const accessEmpresa = String((criada.json.sessao as { accessToken: string }).accessToken);
    const codigo = extrairCodigo(emailTeste.ultimoPara('financeiro@acme.com.br')?.texto ?? '');
    await api(
      `/empresas/${empresaId}/verificacao/email`,
      { method: 'POST', body: JSON.stringify({ codigo }) },
      accessEmpresa,
    );
    fonteCnpjTeste.definir(CNPJ, { situacaoAtiva: true, razaoSocial: 'Acme Ltda', indisponivel: false });
    const job = await api(`/interno/empresas/${empresaId}/verificar-cnpj`, {
      method: 'POST',
      headers: { 'x-internal-token': 'job-teste' },
    });
    assert.equal(job.json.exigeRevisaoManual, true);
    assert.equal(job.json.statusVerificacao, 'PENDENTE');

    const admin = await registrar('admin@plataforma.test');
    const usuario = await repositorioTeste.buscarUsuarioPorEmail('admin@plataforma.test');
    assert.ok(usuario);
    await repositorioTeste.atualizarUsuario(usuario.id, { papeisGlobais: ['ADMIN_PLATAFORMA'] });
    const relogin = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@plataforma.test', senha: admin.senha }),
    });
    const semMfa = String(relogin.json.accessToken);
    const filaNegada = await api('/admin/empresas/fila', {}, semMfa);
    assert.equal(filaNegada.status, 403);
    assert.equal(filaNegada.json.codigo, 'MFA_OBRIGATORIO');

    const inicio = await api('/auth/mfa/iniciar', { method: 'POST' }, semMfa);
    const segredo = new URL(String(inicio.json.otpauthUrl)).searchParams.get('secret');
    assert.ok(segredo);
    const codigoMfa = codigoTotp(segredo);
    const confirmado = await api(
      '/auth/mfa/confirmar',
      { method: 'POST', body: JSON.stringify({ codigo: codigoMfa }) },
      semMfa,
    );
    assert.equal(confirmado.status, 201);
    assert.equal(Array.isArray(confirmado.json.codigosRecuperacao), true);
    const verificado = await api(
      '/auth/mfa/verificar',
      { method: 'POST', body: JSON.stringify({ codigo: codigoTotp(segredo) }) },
      semMfa,
    );
    const accessAdmin = String(verificado.json.accessToken);
    const visao = await api(
      '/me/visao',
      { method: 'PATCH', body: JSON.stringify({ visao: 'ADMIN' }) },
      accessAdmin,
    );
    const tokenAdmin = String(visao.json.accessToken);
    const fila = await api('/admin/empresas/fila', {}, tokenAdmin);
    assert.equal(fila.status, 200);
    assert.equal((fila.json as unknown[]).length > 0, true);

    const reauth = await api(
      '/auth/reautenticar',
      { method: 'POST', body: JSON.stringify({ codigo: codigoTotp(segredo) }) },
      tokenAdmin,
    );
    const aprovada = await api(
      `/admin/empresas/${empresaId}/aprovar`,
      {
        method: 'POST',
        body: JSON.stringify({ motivo: 'documentos conferidos' }),
        headers: { 'x-reauth-token': String(reauth.json.reauthToken) },
      },
      tokenAdmin,
    );
    assert.equal(aprovada.status, 201);
    assert.equal(aprovada.json.statusVerificacao, 'VERIFICADA');
  });

  it('candidato recebe 403 na empresa e quem tem os dois papéis troca de visão', async () => {
    const dona = await registrar('dona3@acme.com.br');
    const criada = await api(
      '/empresas/cadastro',
      {
        method: 'POST',
        body: JSON.stringify({
          razaoSocial: 'Acme Ltda',
          nomeFantasia: 'Acme',
          cnpj: CNPJ,
          dominio: 'acme.com.br',
          responsavelNome: 'Ana',
          responsavelEmail: 'rh@acme.com.br',
        }),
      },
      dona.access,
    );
    const empresaId = String((criada.json.empresa as { id: string }).id);
    const accessEmpresa = String((criada.json.sessao as { accessToken: string }).accessToken);

    const candidato = await registrar('joao@pessoal.test');
    await api('/onboarding/candidato', { method: 'POST', body: JSON.stringify({ nome: 'João' }) }, candidato.access);
    const negado = await api(`/empresas/${empresaId}/membros`, {}, candidato.access);
    assert.equal(negado.status, 403);

    await api('/onboarding/candidato', { method: 'POST', body: JSON.stringify({ nome: 'Ana' }) }, accessEmpresa);
    const comoCandidato = await api(
      '/me/visao',
      { method: 'PATCH', body: JSON.stringify({ visao: 'CANDIDATO' }) },
      accessEmpresa,
    );
    assert.equal(comoCandidato.status, 200);
    const bloqueado = await api(
      `/empresas/${empresaId}/membros`,
      {},
      String(comoCandidato.json.accessToken),
    );
    assert.equal(bloqueado.status, 403);
    const comoEmpresa = await api(
      '/me/visao',
      { method: 'PATCH', body: JSON.stringify({ visao: 'EMPRESA', empresaId }) },
      String(comoCandidato.json.accessToken),
    );
    const membros = await api(`/empresas/${empresaId}/membros`, {}, String(comoEmpresa.json.accessToken));
    assert.equal(membros.status, 200);
  });

  it('convida recrutador e não cria empresa por convite', async () => {
    const dona = await registrar('dona4@acme.com.br');
    const criada = await api(
      '/empresas/cadastro',
      {
        method: 'POST',
        body: JSON.stringify({
          razaoSocial: 'Acme Ltda',
          nomeFantasia: 'Acme',
          cnpj: CNPJ,
          dominio: 'acme.com.br',
          responsavelNome: 'Ana',
          responsavelEmail: 'pessoas@acme.com.br',
        }),
      },
      dona.access,
    );
    const empresaId = String((criada.json.empresa as { id: string }).id);
    const accessEmpresa = String((criada.json.sessao as { accessToken: string }).accessToken);
    const antes = (await repositorioTeste.listarEmpresas({ isAdmin: true })).length;
    const inexistente = await api('/empresas/convite', { method: 'POST', body: '{}' }, accessEmpresa);
    assert.equal(inexistente.status, 404);
    const papelInvalido = await api(
      `/empresas/${empresaId}/membros/convites`,
      { method: 'POST', body: JSON.stringify({ email: 'r@acme.com.br', papeis: ['ADMIN_EMPRESA'] }) },
      accessEmpresa,
    );
    assert.equal(papelInvalido.status, 400);
    const convite = await api(
      `/empresas/${empresaId}/membros/convites`,
      { method: 'POST', body: JSON.stringify({ email: 'recrutador@acme.com.br', papeis: ['RECRUTADOR'] }) },
      accessEmpresa,
    );
    assert.equal(convite.status, 201);
    assert.equal((await repositorioTeste.listarEmpresas({ isAdmin: true })).length, antes);
    const token = extrairToken(emailTeste.ultimoPara('recrutador@acme.com.br')?.texto ?? '');
    assert.ok(token);
    const recrutador = await registrar('recrutador@acme.com.br');
    const aceite = await api(
      '/convites/aceitar',
      { method: 'POST', body: JSON.stringify({ token }) },
      recrutador.access,
    );
    assert.equal(aceite.status, 201);
    const visao = await api(
      '/me/visao',
      { method: 'PATCH', body: JSON.stringify({ visao: 'EMPRESA', empresaId }) },
      recrutador.access,
    );
    const publicar = await api(
      `/empresas/${empresaId}/vagas/publicar`,
      { method: 'POST' },
      String(visao.json.accessToken),
    );
    assert.equal(publicar.status, 403);
  });

  it('acesso de admin a áudio gera auditoria append-only', async () => {
    const admin = await registrar('auditor@plataforma.test');
    const usuario = await repositorioTeste.buscarUsuarioPorEmail('auditor@plataforma.test');
    assert.ok(usuario);
    await repositorioTeste.atualizarUsuario(usuario.id, { papeisGlobais: ['ADMIN_PLATAFORMA'] });
    const relogin = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'auditor@plataforma.test', senha: admin.senha }),
    });
    const semMfa = String(relogin.json.accessToken);
    const inicio = await api('/auth/mfa/iniciar', { method: 'POST' }, semMfa);
    const segredo = new URL(String(inicio.json.otpauthUrl)).searchParams.get('secret') ?? '';
    await api('/auth/mfa/confirmar', { method: 'POST', body: JSON.stringify({ codigo: codigoTotp(segredo) }) }, semMfa);
    const verificado = await api(
      '/auth/mfa/verificar',
      { method: 'POST', body: JSON.stringify({ codigo: codigoTotp(segredo) }) },
      semMfa,
    );
    const visao = await api(
      '/me/visao',
      { method: 'PATCH', body: JSON.stringify({ visao: 'ADMIN' }) },
      String(verificado.json.accessToken),
    );
    const tokenAdmin = String(visao.json.accessToken);
    const respostaId = '11111111-1111-1111-1111-111111111111';
    const empresaId = '22222222-2222-2222-2222-222222222222';
    await repositorioTeste.guardarResposta({
      id: respostaId,
      empresaId,
      audioUrl: 's3://audio',
      transcricao: 'olá',
    });
    const reauth = await api(
      '/auth/reautenticar',
      { method: 'POST', body: JSON.stringify({ codigo: codigoTotp(segredo) }) },
      tokenAdmin,
    );
    const audio = await api(`/admin/audios/${respostaId}?motivo=suporte%20ao%20cliente`, {
      headers: { authorization: `Bearer ${tokenAdmin}`, 'x-reauth-token': String(reauth.json.reauthToken) },
    });
    assert.equal(audio.status, 200);
    const trilha = await api('/admin/auditoria', {}, tokenAdmin);
    const eventos = trilha.json as unknown as Array<{ acao: string; recursoTipo: string; motivo: string }>;
    assert.equal(eventos.some((evento) => evento.acao === 'LER_AUDIO' && evento.motivo.includes('suporte')), true);
    await assert.rejects(() => repositorioTeste.alterarAuditoria(), /append-only/);
  });

  it('conecta o WhatsApp da empresa sem devolver o token e o admin lista a instância', async () => {
    const dona = await registrar('dona5@acme.com.br');
    const criada = await api(
      '/empresas/cadastro',
      {
        method: 'POST',
        body: JSON.stringify({
          razaoSocial: 'Acme Ltda',
          nomeFantasia: 'Acme',
          cnpj: CNPJ,
          dominio: 'acme.com.br',
          responsavelNome: 'Ana',
          responsavelEmail: 'wa@acme.com.br',
        }),
      },
      dona.access,
    );
    const empresaId = String((criada.json.empresa as { id: string }).id);
    const accessEmpresa = String((criada.json.sessao as { accessToken: string }).accessToken);
    const instancia = await api(`/empresas/${empresaId}/whatsapp/instancia`, { method: 'POST' }, accessEmpresa);
    assert.equal(instancia.status, 201);
    assert.equal(instancia.json.status, 'AGUARDANDO_QR');
    assert.equal(JSON.stringify(instancia.json).includes('tokenCifrado'), false);
    assert.equal(JSON.stringify(instancia.json).includes('tok-Acme'), false);
    const qr = await api(`/empresas/${empresaId}/whatsapp/conectar`, { method: 'POST' }, accessEmpresa);
    assert.equal(qr.status, 201);
    assert.match(String(qr.json.qrcode), /^qr:/);
    whatsappTeste.conectadas.add('tok-Acme');
    const status = await api(`/empresas/${empresaId}/whatsapp/status`, {}, accessEmpresa);
    assert.equal(status.status, 200);
    assert.equal(status.json.status, 'CONECTADA');
    assert.equal(status.json.numero, '5511999990000');
    assert.equal(whatsappTeste.webhooks.length, 1);

    const admin = await registrar('wa-admin@plataforma.test');
    const usuario = await repositorioTeste.buscarUsuarioPorEmail('wa-admin@plataforma.test');
    assert.ok(usuario);
    await repositorioTeste.atualizarUsuario(usuario.id, { papeisGlobais: ['ADMIN_PLATAFORMA'] });
    const relogin = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'wa-admin@plataforma.test', senha: admin.senha }),
    });
    const semMfa = String(relogin.json.accessToken);
    const inicio = await api('/auth/mfa/iniciar', { method: 'POST' }, semMfa);
    const segredo = new URL(String(inicio.json.otpauthUrl)).searchParams.get('secret') ?? '';
    await api('/auth/mfa/confirmar', { method: 'POST', body: JSON.stringify({ codigo: codigoTotp(segredo) }) }, semMfa);
    const verificado = await api(
      '/auth/mfa/verificar',
      { method: 'POST', body: JSON.stringify({ codigo: codigoTotp(segredo) }) },
      semMfa,
    );
    const visao = await api(
      '/me/visao',
      { method: 'PATCH', body: JSON.stringify({ visao: 'ADMIN' }) },
      String(verificado.json.accessToken),
    );
    const lista = await api('/admin/whatsapp/instancias', {}, String(visao.json.accessToken));
    assert.equal(lista.status, 200);
    assert.equal(JSON.stringify(lista.json).includes('tok-Acme'), false);
    assert.equal((lista.json as unknown[]).length, 1);
  });
});
