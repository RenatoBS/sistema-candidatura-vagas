import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import { codigoTotp } from '../src/auth/segredos';
import { api, CNPJ_A, conta, derrubarApp, empresaVerificada, entrar, limparAmbienteTeste, payload, repositorioTeste, subirApp } from './ajuda-http';

async function adminComMfa(email: string) {
  const access = await conta(email);
  const usuario = await repositorioTeste.buscarUsuarioPorEmail(email);
  assert.ok(usuario);
  await repositorioTeste.atualizarUsuario(usuario.id, { papeisGlobais: ['ADMIN_PLATAFORMA'] });
  const iniciado = await api('/auth/mfa/iniciar', { method: 'POST' }, access);
  assert.equal(iniciado.status, 201, JSON.stringify(iniciado.json));
  const segredo = new URL(String(iniciado.json.otpauthUrl)).searchParams.get('secret') ?? '';
  return { usuarioId: usuario.id, access, segredo };
}

const agora = () => Date.now();
const codigoEm = (segredo: string, deslocamentoSegundos: number) => codigoTotp(segredo, agora() + deslocamentoSegundos * 1000);
const post = (caminho: string, codigo: string, token: string) =>
  api(caminho, { method: 'POST', body: JSON.stringify({ codigo }) }, token);

describe('FC-15 — TOTP sem reuso', () => {
  before(subirApp);
  after(derrubarApp);
  beforeEach(limparAmbienteTeste);

  it('o mesmo código TOTP usado duas vezes é recusado (401) na segunda', async () => {
    const { access, segredo } = await adminComMfa('totp@pessoal.test');
    const primeiro = codigoEm(segredo, 0);
    const confirmada = await post('/auth/mfa/confirmar', primeiro, access);
    assert.equal(confirmada.status, 201);
    // A confirmação já devolve a sessão com MFA verificado: o app segue sem pedir outro código.
    assert.equal(payload(String(confirmada.json.accessToken)).mfaVerificado, true);
    assert.ok(confirmada.json.refreshToken);

    // Mesmo código, mesma janela: já consumido na confirmação.
    assert.equal((await post('/auth/mfa/verificar', primeiro, access)).status, 401);
    assert.equal((await api('/auth/reautenticar', { method: 'POST', body: JSON.stringify({ codigo: primeiro }) }, access)).status, 401);

    // Código do passo seguinte (dentro da tolerância) vale uma vez...
    const seguinte = codigoEm(segredo, 30);
    assert.notEqual(seguinte, primeiro);
    const verificada = await post('/auth/mfa/verificar', seguinte, access);
    assert.equal(verificada.status, 201, JSON.stringify(verificada.json));
    // ...e não vale de novo, nem em outra rota.
    assert.equal((await post('/auth/mfa/verificar', seguinte, access)).status, 401);
    assert.equal((await api('/auth/reautenticar', { method: 'POST', body: JSON.stringify({ codigo: seguinte }) }, access)).status, 401);
    // Código de passo anterior ao último aceito também não volta.
    assert.equal((await post('/auth/mfa/verificar', primeiro, access)).status, 401);
  });

  it('código de recuperação continua de uso único e TOTP errado segue 401', async () => {
    const { access, segredo } = await adminComMfa('totp2@pessoal.test');
    const confirmacao = await post('/auth/mfa/confirmar', codigoEm(segredo, 0), access);
    const [recuperacao] = confirmacao.json.codigosRecuperacao as string[];
    assert.ok(recuperacao);
    assert.equal((await post('/auth/mfa/verificar', '000000', access)).status, 401);
    assert.equal((await post('/auth/mfa/verificar', recuperacao, access)).status, 201);
    assert.equal((await post('/auth/mfa/verificar', recuperacao, access)).status, 401);
  });
});

describe('FC-15 — leituras do admin com bypass são auditadas', () => {
  before(subirApp);
  after(derrubarApp);
  beforeEach(limparAmbienteTeste);

  async function tokenAdmin(email: string) {
    const { usuarioId, access, segredo } = await adminComMfa(email);
    assert.equal((await post('/auth/mfa/confirmar', codigoEm(segredo, 0), access)).status, 201);
    const verificada = await post('/auth/mfa/verificar', codigoEm(segredo, 30), access);
    assert.equal(verificada.status, 201, JSON.stringify(verificada.json));
    const visao = await api('/me/visao', { method: 'PATCH', body: JSON.stringify({ visao: 'ADMIN' }) }, String(verificada.json.accessToken));
    assert.equal(visao.status, 200, JSON.stringify(visao.json));
    return { usuarioId, token: String(visao.json.accessToken) };
  }

  const leituras = async () => (await repositorioTeste.listarAuditoria({ isAdmin: true })).filter((item) => item.acao === 'LEITURA_ADMIN');

  it('GET de dados de empresa e da área admin gera LEITURA_ADMIN com quem, o quê, quando e motivo', async () => {
    const empresa = await empresaVerificada(await conta('dona@pessoal.test'), CNPJ_A, 'Acme');
    const admin = await tokenAdmin('admin-aud@pessoal.test');
    assert.equal((await leituras()).length, 0);

    assert.equal((await api(`/empresas/${empresa.empresaId}/membros`, {}, admin.token)).status, 200);
    assert.equal((await api(`/empresas/${empresa.empresaId}/membros?motivo=suporte%20chamado%20123`, {}, admin.token)).status, 200);
    assert.equal((await api('/admin/empresas', {}, admin.token)).status, 200);

    const registros = (await leituras()).sort((a, b) => a.criadoEm.getTime() - b.criadoEm.getTime());
    assert.equal(registros.length, 3);
    for (const registro of registros) {
      assert.equal(registro.usuarioId, admin.usuarioId);
      assert.equal(registro.papel, 'ADMIN_PLATAFORMA');
      assert.ok(registro.criadoEm instanceof Date);
    }
    assert.equal(registros[0]?.recursoTipo, 'GET empresas/:empresaId/membros');
    assert.equal(registros[0]?.recursoId, empresa.empresaId);
    assert.equal(registros[0]?.empresaId, empresa.empresaId);
    assert.equal(registros[0]?.motivo, 'consulta administrativa');
    assert.equal(registros[1]?.motivo, 'suporte chamado 123');
    assert.equal(registros[2]?.recursoTipo, 'GET admin/empresas');
  });

  it('leitura feita como membro da própria empresa não gera auditoria de bypass', async () => {
    const empresa = await empresaVerificada(await conta('dona2@pessoal.test'), CNPJ_A, 'Acme');
    const { access } = await entrar('dona2@pessoal.test');
    assert.ok(access);
    assert.equal((await api(`/empresas/${empresa.empresaId}/membros`, {}, empresa.token)).status, 200);
    assert.equal((await leituras()).length, 0);
  });
});
