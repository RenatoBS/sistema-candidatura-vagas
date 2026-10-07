import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { textoDoRoteiro } from './roteiro';

describe('roteiro do simulador', () => {
  it('avança a resposta e repete quando o sistema pede texto', () => {
    const primeira = textoDoRoteiro({ ultimaSaida: 'Pergunta 1 de 3', indice: 0, ultimoTextoEnviado: null });
    assert.match(primeira.texto, /incidente/);
    assert.equal(primeira.indice, 1);
    const repetida = textoDoRoteiro({
      ultimaSaida: 'Se não puder, pode responder em texto na próxima mensagem.',
      indice: 1,
      ultimoTextoEnviado: primeira.texto,
    });
    assert.equal(repetida.texto, primeira.texto);
    assert.equal(repetida.indice, 1);
  });
});
