import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  deslocarMes,
  diaPermitido,
  hojeEmBrasilia,
  mascararPrazo,
  montarPrazo,
  normalizarPrazo,
  partesDoPrazo,
  prazoEmDias,
  problemaDoPrazo,
  semanasDoMes,
} from './prazo';

// 07/10/2026 12:00 em Brasília = 15:00Z
const AGORA = new Date('2026-10-07T15:00:00.000Z');

describe('prazo da vaga', () => {
  it('máscara coloca barras, espaço e dois-pontos sozinha e ignora letras', () => {
    assert.equal(mascararPrazo('2'), '2');
    assert.equal(mascararPrazo('201'), '20/1');
    assert.equal(mascararPrazo('20112026'), '20/11/2026');
    assert.equal(mascararPrazo('201120262359'), '20/11/2026 23:59');
    assert.equal(mascararPrazo('20/11/2026 23:59'), '20/11/2026 23:59');
    assert.equal(mascararPrazo('2a0b1'), '20/1');
    assert.equal(mascararPrazo('2011202623599999'), '20/11/2026 23:59');
    assert.equal(mascararPrazo('20/'), '20');
  });

  it('atalhos: daqui a N dias às 23:59 de Brasília (inclusive na virada do dia UTC)', () => {
    assert.equal(prazoEmDias(7, AGORA), '14/10/2026 23:59');
    assert.equal(prazoEmDias(30, AGORA), '06/11/2026 23:59');
    // 23:30 em Brasília de 31/10 já é 01/11 02:30Z: o dia local manda.
    assert.equal(prazoEmDias(1, new Date('2026-11-01T02:30:00.000Z')), '01/11/2026 23:59');
  });

  it('valida data completa, calendário real e futuro', () => {
    assert.equal(problemaDoPrazo('', AGORA), null);
    assert.equal(problemaDoPrazo('20/11/2026', AGORA), null);
    assert.equal(problemaDoPrazo('20/11/2026 23:59', AGORA), null);
    assert.equal(problemaDoPrazo('20/11', AGORA), 'INCOMPLETO');
    assert.equal(problemaDoPrazo('20/11/2026 23', AGORA), 'INVALIDO');
    assert.equal(problemaDoPrazo('31/02/2027', AGORA), 'INVALIDO');
    assert.equal(problemaDoPrazo('20/13/2027', AGORA), 'INVALIDO');
    assert.equal(problemaDoPrazo('20/11/2027 25:00', AGORA), 'INVALIDO');
    assert.equal(problemaDoPrazo('06/10/2026', AGORA), 'PASSADO');
    assert.equal(problemaDoPrazo('07/10/2026 11:59', AGORA), 'PASSADO');
    assert.equal(problemaDoPrazo('07/10/2026 12:01', AGORA), null);
  });

  it('converte para o formato da API', () => {
    assert.equal(normalizarPrazo('20/11/2026 18:30'), '2026-11-20T18:30');
    assert.equal(normalizarPrazo('20/11/2026'), '2026-11-20T23:59');
    assert.equal(normalizarPrazo('  '), null);
    assert.equal(normalizarPrazo('2026-11-20T23:59'), '2026-11-20T23:59');
  });
});

describe('calendário do prazo', () => {
  it('monta as semanas do mês (outubro/2026 começa numa quinta e tem 31 dias)', () => {
    const semanas = semanasDoMes(2026, 10);
    assert.deepEqual(semanas[0], [null, null, null, null, 1, 2, 3]);
    assert.deepEqual(semanas.at(-1), [25, 26, 27, 28, 29, 30, 31]);
    assert.equal(semanas.length, 5);
    assert.ok(semanas.every((semana) => semana.length === 7));
    assert.equal(semanasDoMes(2028, 2).flat().filter(Boolean).length, 29, 'fevereiro bissexto');
    assert.equal(semanasDoMes(2027, 2).flat().filter(Boolean).length, 28);
  });

  it('navega entre meses atravessando o ano', () => {
    assert.deepEqual(deslocarMes({ ano: 2026, mes: 12 }, 1), { ano: 2027, mes: 1 });
    assert.deepEqual(deslocarMes({ ano: 2026, mes: 1 }, -1), { ano: 2025, mes: 12 });
    assert.deepEqual(deslocarMes({ ano: 2026, mes: 10 }, 0), { ano: 2026, mes: 10 });
  });

  it('hoje é o dia de Brasília e dias passados ficam bloqueados', () => {
    // 01/11/2026 02:30Z ainda é 31/10 em Brasília
    const hoje = hojeEmBrasilia(new Date('2026-11-01T02:30:00.000Z'));
    assert.deepEqual(hoje, { ano: 2026, mes: 10, dia: 31 });
    assert.equal(diaPermitido(2026, 10, 30, hoje), false);
    assert.equal(diaPermitido(2026, 10, 31, hoje), true);
    assert.equal(diaPermitido(2026, 11, 1, hoje), true);
    assert.equal(diaPermitido(2025, 12, 31, hoje), false);
  });

  it('converte entre texto e partes (hora ausente = 23:59)', () => {
    assert.deepEqual(partesDoPrazo('20/11/2026 18:30'), { dia: 20, mes: 11, ano: 2026, hora: 18, minuto: 30 });
    assert.deepEqual(partesDoPrazo('20/11/2026'), { dia: 20, mes: 11, ano: 2026, hora: 23, minuto: 59 });
    assert.equal(partesDoPrazo('31/02/2027'), null);
    assert.equal(partesDoPrazo('20/11'), null);
    assert.equal(montarPrazo({ ano: 2026, mes: 3, dia: 5, hora: 9, minuto: 0 }), '05/03/2026 09:00');
  });
});
