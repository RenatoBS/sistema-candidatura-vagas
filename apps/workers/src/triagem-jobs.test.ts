import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { processarReenvioConviteTriagem } from './triagem-fila';
import { agendarTranscricao, processarJobTranscricao } from './triagem-jobs';
describe('jobs de transcrição', () => {
  it('agenda três tentativas com backoff exponencial', () => {
    const job = agendarTranscricao('r1');
    assert.equal(job.options.attempts, 3);
    assert.equal(job.options.backoff.type, 'exponential');
  });
  it('chama rota interna e marca falha ao esgotar tentativas', async () => {
    const chamadas: string[] = [];
    await assert.rejects(() =>
      processarJobTranscricao(
        { data: { respostaId: 'r1' }, attemptsMade: 2, opts: { attempts: 3 } },
        async (url, init) => {
          chamadas.push(`${url}:${(init?.headers as Record<string, string>)['x-internal-token']}`);
          return new Response(JSON.stringify({ ok: true }), {
            status: chamadas.length === 1 ? 500 : 200,
          });
        },
        { API_PUBLIC_URL: 'http://api.test', INTERNAL_JOB_TOKEN: 'job' },
      ),
    );
    assert.equal(chamadas.length, 2);
  });
});

describe('reenvio do convite da triagem', () => {
  it('chama a rota interna com a tentativa', async () => {
    let chamada = '';
    await processarReenvioConviteTriagem(
      'e1',
      3,
      async (url, init) => {
        chamada = `${url}:${String(init?.body)}`;
        return new Response('{}', { status: 200 });
      },
      { API_PUBLIC_URL: 'http://api.test', INTERNAL_JOB_TOKEN: 'job' },
    );
    assert.equal(chamada, 'http://api.test/api/v1/interno/triagem/entrevistas/e1/reenviar-convite:{"tentativa":3}');
  });
});
