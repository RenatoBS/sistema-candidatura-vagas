import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { assinaturaConfere, TAMANHO_MAX_CURRICULO_BYTES, validarDeclaracaoArquivo } from './arquivo-curriculo';

describe('arquivo de currículo', () => {
  it('rejeita tipo e tamanho fora da política', () => {
    assert.equal(validarDeclaracaoArquivo('text/plain', 100).ok, false);
    assert.equal(validarDeclaracaoArquivo('application/pdf', TAMANHO_MAX_CURRICULO_BYTES + 1).ok, false);
    assert.equal(validarDeclaracaoArquivo('image/png', 12).ok, true);
  });

  it('confere a assinatura com o MIME declarado', () => {
    const pdf = Buffer.from('%PDF-1.4 curriculo');
    assert.equal(assinaturaConfere(pdf, 'application/pdf'), true);
    assert.equal(assinaturaConfere(pdf, 'image/png'), false);
  });
});
