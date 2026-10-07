import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  consentimentosParaSalvar,
  estadoRevisao,
  habilidadesMarcadas,
  situacaoCurriculo,
  TIPOS_PRIVACIDADE_EXIBIDOS,
} from './regras';

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

  it('classifica os CVs da lista, destacando os que aguardam confirmação', () => {
    assert.equal(situacaoCurriculo({ statusProcessamento: 'PENDENTE', aplicadoAoPerfil: false }), 'PENDENTE');
    assert.equal(situacaoCurriculo({ statusProcessamento: 'PROCESSANDO', aplicadoAoPerfil: false }), 'PROCESSANDO');
    assert.equal(situacaoCurriculo({ statusProcessamento: 'FALHA', aplicadoAoPerfil: false }), 'FALHA');
    assert.equal(situacaoCurriculo({ statusProcessamento: 'CONCLUIDO', aplicadoAoPerfil: false }), 'AGUARDANDO');
    assert.equal(situacaoCurriculo({ statusProcessamento: 'CONCLUIDO', aplicadoAoPerfil: true }), 'APLICADO');
  });

  it('visibilidade para match tem um único interruptor que também grava o consentimento', () => {
    assert.ok(!(TIPOS_PRIVACIDADE_EXIBIDOS as readonly string[]).includes('VISIBILIDADE_MATCH'));
    const salvos = consentimentosParaSalvar({ TERMOS: true, VISIBILIDADE_MATCH: false }, true);
    assert.equal(salvos.find((item) => item.tipo === 'VISIBILIDADE_MATCH')?.concedido, true);
    assert.equal(salvos.find((item) => item.tipo === 'TERMOS')?.concedido, true);
    assert.equal(salvos.find((item) => item.tipo === 'WHATSAPP')?.concedido, false);
  });
});
