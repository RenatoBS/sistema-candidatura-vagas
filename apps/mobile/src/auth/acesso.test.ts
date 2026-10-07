import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { chaveConsulta, empresaAtivaDaSessao, rotaInicial, podeAcessarGrupo, podeAcao, type SessaoApp } from './acesso';

function sessao(parcial: Partial<SessaoApp>): SessaoApp {
  return {
    id: 'u1',
    email: 'ana@acme.com',
    papeisGlobais: [],
    mfaAtivo: false,
    mfaVerificado: false,
    visao: 'CANDIDATO',
    empresaAtivaId: null,
    ehCandidato: false,
    empresas: [],
    ...parcial,
  };
}

describe('navegação por papel', () => {
  it('admin sem MFA não entra no grupo admin', () => {
    const admin = sessao({
      papeisGlobais: ['ADMIN_PLATAFORMA'],
      visao: 'ADMIN',
      mfaAtivo: false,
    });
    assert.equal(podeAcessarGrupo(admin, 'admin').ok, false);
    assert.equal(podeAcessarGrupo(admin, 'admin').redirecionar, '/mfa');
    assert.equal(podeAcao(admin, 'aprovar_verificacao_empresa'), false);
  });

  it('admin com MFA entra e o candidato não vê score', () => {
    const admin = sessao({
      papeisGlobais: ['ADMIN_PLATAFORMA'],
      visao: 'ADMIN',
      mfaAtivo: true,
      mfaVerificado: true,
    });
    assert.equal(podeAcessarGrupo(admin, 'admin').ok, true);
    const candidato = sessao({ visao: 'CANDIDATO', ehCandidato: true });
    assert.equal(podeAcessarGrupo(candidato, 'candidato').ok, true);
    assert.equal(podeAcessarGrupo(candidato, 'empresa').ok, false);
    assert.equal(podeAcao(candidato, 'ver_score'), false);
    assert.equal(podeAcao(candidato, 'gerenciar_membros', 'empresa-1'), false);
  });

  it('segmenta o cache por visão e empresa', () => {
    assert.deepEqual(chaveConsulta('EMPRESA', 'e1', ['whatsapp']), ['EMPRESA', 'e1', 'whatsapp']);
    assert.notDeepEqual(chaveConsulta('EMPRESA', 'e1', ['whatsapp']), chaveConsulta('EMPRESA', 'e2', ['whatsapp']));
    assert.notDeepEqual(chaveConsulta('ADMIN', 'e1', ['whatsapp']), chaveConsulta('EMPRESA', 'e1', ['whatsapp']));
  });
});
describe('empresa ativa', () => {
  const empresa = (empresaId: string) => ({
    empresaId,
    nomeFantasia: 'Acme',
    papeis: ['ADMIN_EMPRESA' as const],
    status: 'ATIVO' as const,
    statusVerificacao: 'VERIFICADA' as const,
  });

  it('usa a empresa ativa da sessão', () => {
    assert.equal(empresaAtivaDaSessao(sessao({ empresaAtivaId: 'e2', empresas: [empresa('e1'), empresa('e2')] })), 'e2');
  });

  it('cai na primeira empresa quando a sessão não tem empresa ativa', () => {
    assert.equal(empresaAtivaDaSessao(sessao({ empresaAtivaId: null, empresas: [empresa('e1')] })), 'e1');
  });

  it('devolve vazio sem sessão ou sem empresas', () => {
    assert.equal(empresaAtivaDaSessao(null), '');
    assert.equal(empresaAtivaDaSessao(sessao({ empresaAtivaId: null, empresas: [] })), '');
  });

  it('a permissão usa a mesma empresa de fallback', () => {
    const dono = sessao({ visao: 'EMPRESA', empresaAtivaId: null, empresas: [empresa('e1')] });
    assert.equal(podeAcao(dono, 'gerenciar_membros'), true);
    assert.equal(podeAcao(dono, 'gerenciar_membros', ''), true);
  });
});

describe('rotaInicial', () => {
  it('candidato puro vai direto para /candidato', () => {
    assert.equal(rotaInicial(sessao({ ehCandidato: true, visao: 'CANDIDATO', empresas: [] })), '/candidato');
  });
  it('sem sessão vai para /login', () => {
    assert.equal(rotaInicial(null), '/login');
  });
});
