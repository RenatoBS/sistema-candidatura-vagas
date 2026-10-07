import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  calcularScore,
  deveAguardarDebounce,
  mediaFase,
  PESOS_PADRAO,
  validarPesos,
  vazarRanking,
  type ChaveScore,
} from './score';

function componentes(valores: Partial<Record<ChaveScore, number | null>>) {
  const base = {} as Record<ChaveScore, { valor: number | null }>;
  for (const chave of Object.keys(PESOS_PADRAO) as ChaveScore[]) {
    base[chave] = { valor: valores[chave] === undefined ? 100 : valores[chave] };
  }
  return base;
}

describe('score', () => {
  it('renormaliza componente ausente e mostra completude', () => {
    const completo = calcularScore({ componentes: componentes({}), pesos: { ...PESOS_PADRAO } });
    assert.equal(completo.completude, 1);
    assert.equal(completo.scoreFinal, 100);
    const parcial = calcularScore({
      componentes: componentes({ voz: null, triagem: 80 }),
      pesos: { ...PESOS_PADRAO },
    });
    assert.equal(parcial.componentesPresentes, 5);
    assert.match(parcial.explicacao.texto, /5 de 6/);
    assert.ok(parcial.scoreFinal < 100);
    assert.equal(mediaFase([], 0, 'zerado').valor, 0);
    assert.equal(mediaFase([{ nota: 8, conta: true }], 1, 'parcial').sinalizado, true);
  });

  it('rejeita pesos que não somam 100 e detecta vazamento de ranking', () => {
    assert.equal(validarPesos({ ...PESOS_PADRAO }).ok, true);
    assert.equal(validarPesos({ ...PESOS_PADRAO, voz: 10 }).ok, false);
    assert.deepEqual(vazarRanking({ status: 'INSCRITA', aninhado: { scoreFinal: 1 } }), ['scoreFinal']);
    assert.equal(deveAguardarDebounce(1_000, 1_500, 2_000), true);
    assert.equal(deveAguardarDebounce(1_000, 4_000, 2_000), false);
  });
});
