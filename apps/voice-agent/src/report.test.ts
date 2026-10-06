import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { montarRelatorio, relatorioParaMarkdown } from './report';

describe('report', () => {
  it('monta relatório com total percebido calculado', () => {
    const relatorio = montarRelatorio({
      modo: 'mock',
      pipeline: 'STT → LLM → TTS (simulado)',
      fixtureAudio: '/tmp/audio.wav',
      etapas: [],
      vadTurnoMs: 220,
      sttMs: 150,
      llmPrimeiroTokenMs: 300,
      llmTotalMs: 400,
      ttsPrimeiroAudioMs: 160,
      ttsTotalMs: 180,
      e2eMs: 900,
      resultado: {
        transcricao: 'teste',
        respostaLlm: 'resposta',
        audioRespostaBytes: 100,
      },
    });

    assert.equal(relatorio.metricas.totalPercebidoMs, 902);
    assert.ok(relatorioParaMarkdown(relatorio).includes('Total percebido'));
  });
});
