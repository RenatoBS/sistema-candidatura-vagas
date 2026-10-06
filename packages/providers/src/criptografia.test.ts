import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { describe, it } from 'node:test';

import { cifrar, decifrar } from './criptografia';

describe('AES-GCM', () => {
  it('cifra e recupera o token da instância', () => {
    const chave = randomBytes(32).toString('base64');
    const cifrado = cifrar('token-da-instancia', chave);
    assert.notEqual(cifrado, 'token-da-instancia');
    assert.equal(decifrar(cifrado, chave), 'token-da-instancia');
  });
});
