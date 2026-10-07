import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { decidirCotaJanela, decidirCotaSimultanea } from './cota';

describe('cotas por tenant', () => {
  it('esgota a janela de um tenant e deixa o outro passar', () => {
    const agora = 1_000_000;
    const cheia = decidirCotaJanela([agora - 10, agora - 5], agora, 60_000, 2);
    assert.equal(cheia.permitido, false);
    assert.ok(cheia.esperaMs > 0);
    const outro = decidirCotaJanela([], agora, 60_000, 2);
    assert.equal(outro.permitido, true);
  });

  it('libera de novo quando o instante sai da janela', () => {
    const agora = 120_000;
    const decisao = decidirCotaJanela([10_000], agora, 60_000, 1);
    assert.equal(decisao.permitido, true);
  });

  it('recusa sessão simultânea só no tenant que já atingiu o limite', () => {
    assert.equal(decidirCotaSimultanea(4, 4), 'recusar');
    assert.equal(decidirCotaSimultanea(3, 4), 'admitir');
    assert.equal(decidirCotaSimultanea(0, 4), 'admitir');
  });
});
