import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ErroApi } from './cliente';
import { deveRepetir, MAX_REPETICOES } from './repeticao';

describe('repetição de consultas', () => {
  it('não repete erros 4xx', () => {
    assert.equal(deveRepetir(0, new ErroApi(403, 'PROIBIDO', 'sem acesso')), false);
    assert.equal(deveRepetir(0, new ErroApi(404, 'NAO_ENCONTRADO', 'não encontrado')), false);
    assert.equal(deveRepetir(0, new ErroApi(400, 'DADOS_INVALIDOS', 'inválido')), false);
  });

  it('repete 5xx e falhas de rede no máximo 2 vezes', () => {
    assert.equal(MAX_REPETICOES, 2);
    assert.equal(deveRepetir(0, new ErroApi(500, 'HTTP', 'erro')), true);
    assert.equal(deveRepetir(1, new TypeError('Network request failed')), true);
    assert.equal(deveRepetir(2, new ErroApi(503, 'HTTP', 'erro')), false);
  });
});
