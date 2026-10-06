import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { estadoRevisao, habilidadesMarcadas } from './regras';

describe('regras de perfil', () => {
  it('avisa revisão e confiança baixa antes de aplicar ao perfil', () => {
    assert.equal(estadoRevisao({ status: 'PENDENTE', baixaConfianca: false, aplicadoAoPerfil: false }), 'processando');
    assert.equal(estadoRevisao({ status: 'CONCLUIDO', baixaConfianca: true, aplicadoAoPerfil: false }), 'baixa_confianca');
    assert.equal(estadoRevisao({ status: 'CONCLUIDO', baixaConfianca: false, aplicadoAoPerfil: false }), 'revisar');
    assert.equal(estadoRevisao({ status: 'CONCLUIDO', baixaConfianca: false, aplicadoAoPerfil: true }), 'aplicado');
  });

  it('marca só as habilidades já escolhidas', () => {
    assert.equal(habilidadesMarcadas([{ habilidadeId: 'a' }], 'a'), true);
    assert.equal(habilidadesMarcadas([{ habilidadeId: 'a' }], 'b'), false);
  });
});
