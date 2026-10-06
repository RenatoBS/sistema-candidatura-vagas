import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { dadosCurriculoValidos, perfilAposConfirmacao, schemaDadosCurriculo } from './dados-curriculo';

describe('dados estruturados do currículo', () => {
  it('exige o JSON Schema com os campos da extração', () => {
    assert.deepEqual(schemaDadosCurriculo.required, ['resumo', 'experiencias', 'formacao', 'idiomas', 'habilidades']);
  });

  it('só altera o perfil quando a confirmação é aplicada', () => {
    const antes: Record<string, unknown> = { cidade: 'Recife' };
    const dados = {
      resumo: 'Engenheira',
      experiencias: [],
      formacao: [],
      idiomas: ['português'],
      habilidades: [{ nome: 'TypeScript', nivel: 3 }],
    };
    assert.equal(dadosCurriculoValidos(dados), true);
    assert.equal('resumo' in antes, false);
    const depois = perfilAposConfirmacao(antes, dados);
    assert.equal(depois.resumo, 'Engenheira');
    assert.equal(depois.cidade, 'Recife');
    assert.equal('score' in depois, false);
  });
});
