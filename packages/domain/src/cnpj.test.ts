import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { cnpjDigitosValidos, razoesCompativeis, somenteDigitosCnpj } from './cnpj';

describe('CNPJ local', () => {
  it('aceita dígitos verificadores válidos com ou sem máscara', () => {
    assert.equal(cnpjDigitosValidos('11.222.333/0001-81'), true);
    assert.equal(somenteDigitosCnpj('11.222.333/0001-81'), '11222333000181');
  });

  it('rejeita sequência repetida e dígito errado', () => {
    assert.equal(cnpjDigitosValidos('11111111111111'), false);
    assert.equal(cnpjDigitosValidos('11222333000180'), false);
    assert.equal(cnpjDigitosValidos('123'), false);
  });

  it('compara razão social ignorando acento, caixa e pontuação', () => {
    assert.equal(razoesCompativeis('Ação Ltda.', 'ACAO LTDA'), true);
    assert.equal(razoesCompativeis('Outra Empresa', 'ACAO LTDA'), false);
  });
});
