import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  avaliarInatividade,
  momentoLembreteInatividade,
  podeReiniciar,
  prazoInatividade,
  registrarPrimeiraResposta,
} from './triagem-inatividade';

const INICIO = new Date('2026-10-08T12:00:00.000Z');

describe('regras de tentativa e inatividade da triagem', () => {
  it('marca a primeira resposta como início e consome a tentativa', () => {
    const resultado = registrarPrimeiraResposta(
      { iniciadaEm: null, ultimaInteracaoEm: null },
      INICIO,
    );
    assert.deepEqual(resultado, {
      iniciadaEm: INICIO,
      ultimaInteracaoEm: INICIO,
      tentativaConsumida: true,
    });
    assert.equal(podeReiniciar(resultado), false);
  });

  it('não reescreve o marco de início em respostas posteriores', () => {
    const anterior = new Date(INICIO.getTime() - 60_000);
    const resultado = registrarPrimeiraResposta(
      { iniciadaEm: anterior, ultimaInteracaoEm: anterior },
      INICIO,
    );
    assert.equal(resultado.iniciadaEm, anterior);
    assert.equal(resultado.ultimaInteracaoEm, INICIO);
  });

  it('calcula lembrete na metade e abandono em 24 horas', () => {
    const entrevista = { iniciadaEm: INICIO, ultimaInteracaoEm: INICIO };
    assert.equal(momentoLembreteInatividade(entrevista)?.toISOString(), '2026-10-09T00:00:00.000Z');
    assert.equal(prazoInatividade(entrevista)?.toISOString(), '2026-10-09T12:00:00.000Z');
    assert.equal(avaliarInatividade(entrevista, new Date('2026-10-08T23:59:59.999Z')), 'NENHUMA');
    assert.equal(avaliarInatividade(entrevista, new Date('2026-10-09T00:00:00.000Z')), 'LEMBRETE');
    assert.equal(avaliarInatividade(entrevista, new Date('2026-10-09T12:00:00.000Z')), 'ABANDONAR');
  });
});
