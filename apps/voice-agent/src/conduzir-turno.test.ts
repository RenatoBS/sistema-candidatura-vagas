import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { conduzirTurnoMock, p50DoTurno } from './conduzir-turno';

describe('conduzir turno', () => {
  it('registra STT, LLM e TTS com p50 local abaixo de 1 s', async () => {
    const totais: number[] = [];
    for (let i = 0; i < 21; i += 1) {
      const turno = await conduzirTurnoMock('Pergunta 1');
      assert.deepEqual(
        turno.etapas.map((etapa) => etapa.nome),
        ['stt', 'llm', 'tts'],
      );
      assert.ok(turno.etapas.every((etapa) => etapa.duracaoMs < 1000));
      totais.push(turno.totalMs);
    }
    assert.ok(p50DoTurno(totais) < 1000);
  });
});
