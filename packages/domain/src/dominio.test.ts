import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { emailConfirmaDominio, normalizarDominio, txtConfirmaDominio } from './dominio';

describe('domínio da empresa', () => {
  it('aceita e-mail no domínio declarado, inclusive subdomínio', () => {
    assert.equal(emailConfirmaDominio('ana@acme.com.br', 'https://www.acme.com.br/sobre'), true);
    assert.equal(emailConfirmaDominio('ana@rh.acme.com.br', 'acme.com.br'), true);
  });

  it('não aceita provedor genérico nem domínio diferente', () => {
    assert.equal(emailConfirmaDominio('ana@gmail.com', 'gmail.com'), false);
    assert.equal(emailConfirmaDominio('ana@outra.com', 'acme.com.br'), false);
  });

  it('confere o TXT scv-verificacao', () => {
    assert.equal(normalizarDominio('ACME.com.br'), 'acme.com.br');
    assert.equal(txtConfirmaDominio(['scv-verificacao=abc'], 'abc'), true);
    assert.equal(txtConfirmaDominio(['outro=abc'], 'abc'), false);
  });
});
