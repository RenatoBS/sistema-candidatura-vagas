import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  aplicarExtraidas,
  CATALOGO_BASE,
  normalizarHabilidades,
  substituirManuais,
  type ItemCatalogo,
} from './habilidades';

const catalogo: ItemCatalogo[] = CATALOGO_BASE.map((item, indice) => ({
  ...item,
  id: `00000000-0000-4000-8000-${String(indice + 1).padStart(12, '0')}`,
}));

describe('habilidades', () => {
  it('casa sinônimo no catálogo e deixa de fora o que não existe', () => {
    const resultado = normalizarHabilidades(
      [
        { nome: 'Postgres', nivel: 4 },
        { nome: 'Kotlin', nivel: 2 },
      ],
      catalogo,
    );
    assert.equal(resultado.mapeadas[0]?.nome, 'PostgreSQL');
    assert.deepEqual(resultado.naoMapeadas, ['Kotlin']);
  });

  it('não substitui habilidade manual pela extraída do CV', () => {
    const ts = catalogo[0]?.id ?? '';
    const atuais = [{ habilidadeId: ts, nivel: 5, anosExperiencia: 2, origem: 'MANUAL' as const }];
    const depois = aplicarExtraidas(atuais, [{ habilidadeId: ts, nivel: 1, anosExperiencia: null, origem: 'CV_EXTRAIDO' }]);
    assert.equal(depois.length, 1);
    assert.equal(depois[0]?.origem, 'MANUAL');
    assert.equal(depois[0]?.nivel, 5);
  });

  it('substitui só as manuais', () => {
    const [ts, js] = catalogo;
    const atuais = [
      { habilidadeId: ts?.id ?? '', nivel: 3, anosExperiencia: null, origem: 'CV_EXTRAIDO' as const },
    ];
    const depois = substituirManuais(atuais, [
      { habilidadeId: js?.id ?? '', nivel: 2, anosExperiencia: 1, origem: 'MANUAL' },
    ]);
    assert.equal(depois.length, 2);
  });
});
