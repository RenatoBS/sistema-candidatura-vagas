import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { agendarInatividade, processarJobInatividade } from './triagem-inatividade';

describe('job de inatividade da triagem', () => {
  it('usa jobId determinístico com a última interação', () => {
    const job = agendarInatividade('entrevista-1', new Date('2026-10-09T12:00:00.000Z'));
    assert.equal(job.options.jobId, 'inatividade:entrevista-1:2026-10-09T12:00:00.000Z');
  });

  it('processa por rota interna com fetch injetado', async () => {
    const chamadas: string[] = [];
    await processarJobInatividade(
      {
        data: {
          entrevistaId: 'entrevista-1',
          ultimaInteracaoEm: '2026-10-09T12:00:00.000Z',
        },
      },
      async (url, init) => {
        chamadas.push(`${url}:${(init?.headers as Record<string, string>)['x-internal-token']}`);
        return new Response(JSON.stringify({ abandonada: true }), { status: 200 });
      },
      { API_PUBLIC_URL: 'http://api.test', INTERNAL_JOB_TOKEN: 'job' },
    );
    assert.deepEqual(chamadas, [
      'http://api.test/api/v1/interno/triagem/entrevistas/entrevista-1/abandonar-inatividade:job',
    ]);
  });
});
