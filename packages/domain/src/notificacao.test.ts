import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  algumCanal,
  canaisEfetivos,
  chaveDedup,
  decidirAgrupamento,
  inicioJanela,
  limiarPreferenciaValido,
  MINIMO_RESUMO_PADRAO,
  vagaNotificavel,
} from './notificacao';

const AGORA = new Date('2026-10-06T15:10:00.000Z');

describe('notificações — dedup e agrupamento', () => {
  it('MATCH_FORTE: uma chave por vaga+candidato+destinatário, independente do horário', () => {
    const base = { tipo: 'MATCH_FORTE' as const, usuarioId: 'u1', vagaId: 'v1', candidatoId: 'c1' };
    assert.equal(chaveDedup(base), chaveDedup({ ...base }));
    assert.notEqual(chaveDedup(base), chaveDedup({ ...base, candidatoId: 'c2' }));
    assert.notEqual(chaveDedup(base), chaveDedup({ ...base, usuarioId: 'u2' }));
  });

  it('CANDIDATO_NOVO: mesma chave dentro da janela, nova chave na janela seguinte', () => {
    const chave = (agora: Date) => chaveDedup({ tipo: 'CANDIDATO_NOVO', usuarioId: 'u1', vagaId: 'v1', agora, janelaMinutos: 60 });
    assert.equal(chave(AGORA), chave(new Date('2026-10-06T15:59:59.999Z')));
    assert.notEqual(chave(AGORA), chave(new Date('2026-10-06T16:00:00.000Z')));
    assert.equal(inicioJanela(AGORA, 60).toISOString(), '2026-10-06T15:00:00.000Z');
    assert.notEqual(chave(AGORA), chaveDedup({ tipo: 'CANDIDATO_NOVO', usuarioId: 'u1', vagaId: 'v2', agora: AGORA }));
  });

  it('10 candidaturas na janela: uma notificação, vira resumo no mínimo e entrega fora só 2 vezes', () => {
    const decisoes = Array.from({ length: 10 }, (_, i) => decidirAgrupamento('CANDIDATO_NOVO', i + 1));
    assert.equal(decisoes.filter((item) => item.entregarFora).length, 2);
    assert.deepEqual(decisoes[0], { resumo: false, entregarFora: true });
    assert.deepEqual(decisoes[MINIMO_RESUMO_PADRAO - 1], { resumo: true, entregarFora: true });
    assert.deepEqual(decisoes[9], { resumo: true, entregarFora: false });
    assert.deepEqual(decidirAgrupamento('MATCH_FORTE', 1), { resumo: false, entregarFora: true });
  });

  it('só vaga PUBLICADA ou INSCRICOES_ENCERRADAS notifica', () => {
    assert.equal(vagaNotificavel('PUBLICADA'), true);
    assert.equal(vagaNotificavel('INSCRICOES_ENCERRADAS'), true);
    for (const status of ['PAUSADA', 'FECHADA', 'RASCUNHO'] as const) assert.equal(vagaNotificavel(status), false);
  });

  it('preferências: canais do usuário, padrão sem e-mail e limiar pessoal de match', () => {
    const contexto = { limiarPlataforma: 0.75 };
    assert.deepEqual(canaisEfetivos('CANDIDATO_NOVO', null, contexto), { inApp: true, push: true, email: false });
    const silencioso = { inApp: false, push: false, email: false, limiarMatch: null };
    assert.equal(algumCanal(canaisEfetivos('CANDIDATO_NOVO', silencioso, contexto)), false);

    const exigente = { inApp: true, push: true, email: true, limiarMatch: 0.9 };
    assert.equal(algumCanal(canaisEfetivos('MATCH_FORTE', exigente, { ...contexto, compatibilidade: 0.85 })), false);
    assert.equal(algumCanal(canaisEfetivos('MATCH_FORTE', exigente, { ...contexto, compatibilidade: 0.92 })), true);
    // Limiar pessoal abaixo do da plataforma não rebaixa o corte.
    const frouxo = { ...exigente, limiarMatch: 0.5 };
    assert.equal(algumCanal(canaisEfetivos('MATCH_FORTE', frouxo, { ...contexto, compatibilidade: 0.6 })), false);
    assert.equal(algumCanal(canaisEfetivos('MATCH_FORTE', null, contexto)), false);

    assert.equal(limiarPreferenciaValido(null), true);
    assert.equal(limiarPreferenciaValido(0.8), true);
    assert.equal(limiarPreferenciaValido(0), false);
    assert.equal(limiarPreferenciaValido(1.2), false);
  });
});
