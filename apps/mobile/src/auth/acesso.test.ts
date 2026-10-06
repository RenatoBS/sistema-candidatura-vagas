import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { chaveConsulta, podeAcessarGrupo, podeAcao, type SessaoApp } from './acesso';

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
