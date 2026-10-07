import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { chaveLegenda } from './legendas';

describe('legendas do demo', () => {
  it('nomeia as seções do roteiro', () => {
    assert.equal(chaveLegenda('/dev/simulador-whatsapp'), 'legenda.entrevista');
    assert.equal(chaveLegenda('/admin/auditoria'), 'legenda.auditoria');
    assert.equal(chaveLegenda('/admin'), 'legenda.admin');
    assert.equal(chaveLegenda('/empresa/vagas/1/triagens/2'), 'legenda.resultado');
    assert.equal(chaveLegenda('/empresa/vagas/1/candidatos'), 'legenda.scores');
    assert.equal(chaveLegenda('/empresa/vagas/nova'), 'legenda.publicar');
    assert.equal(chaveLegenda('/candidato/curriculo'), 'legenda.curriculo');
    assert.equal(chaveLegenda('/candidato/habilidades'), 'legenda.habilidades');
    assert.equal(chaveLegenda('/candidato/vagas'), 'legenda.vagas');
    assert.equal(chaveLegenda('/login'), 'legenda.acesso');
  });
});
