import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { envNumero, envOpcional, envOu } from './index';

describe('@scv/env', () => {
  it('string vazia ou só com espaços conta como ausente', () => {
    assert.equal(envOu({ X: '' }, 'X', 'padrao'), 'padrao');
    assert.equal(envOu({ X: '   ' }, 'X', 'padrao'), 'padrao');
    assert.equal(envOu({}, 'X', 'padrao'), 'padrao');
    assert.equal(envOu({ X: 'valor' }, 'X', 'padrao'), 'valor');
    assert.equal(envOu({ X: ' valor ' }, 'X', 'padrao'), 'valor');
  });

  it('envOpcional devolve undefined para ausente e vazia', () => {
    assert.equal(envOpcional({ X: '' }, 'X'), undefined);
    assert.equal(envOpcional({}, 'X'), undefined);
    assert.equal(envOpcional({ X: 'a' }, 'X'), 'a');
  });

  it('envNumero aplica o padrão para vazio e recusa lixo', () => {
    assert.equal(envNumero({ P: '' }, 'P', 6379), 6379);
    assert.equal(envNumero({ P: '7000' }, 'P', 6379), 7000);
    assert.throws(() => envNumero({ P: 'abc' }, 'P', 1), /P deve ser um número/);
  });
});
