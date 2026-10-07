import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { processarEmbedding, processarMatch } from './match-jobs';

describe('jobs de embedding e match', () => {
  it('chama a API interna de cada sentido sem rede real', async () => {
    const urls: string[] = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      urls.push(url);
      assert.equal((init?.headers as Record<string, string>)['x-internal-token'], 'segredo');
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as typeof fetch;
    const env = { API_PUBLIC_URL: 'http://api.local', INTERNAL_JOB_TOKEN: 'segredo' };
    await processarEmbedding({ name: 'vaga', data: { vagaId: 'v1' } }, fetchImpl, env);
    await processarEmbedding({ name: 'candidato', data: { candidatoId: 'c1' } }, fetchImpl, env);
    await processarMatch({ name: 'vaga', data: { vagaId: 'v1' } }, fetchImpl, env);
    await processarMatch({ name: 'candidato', data: { candidatoId: 'c1' } }, fetchImpl, env);
    assert.deepEqual(urls, [
      'http://api.local/api/v1/interno/match/embeddings/vagas/v1',
      'http://api.local/api/v1/interno/match/embeddings/candidatos/c1',
      'http://api.local/api/v1/interno/match/vagas/v1',
      'http://api.local/api/v1/interno/match/candidatos/c1',
    ]);
  });

  it('rejeita job sem identificador e propaga falha da API para o retry do BullMQ', async () => {
    const ok = (async () => new Response('{}', { status: 200 })) as typeof fetch;
    await assert.rejects(() => processarMatch({ name: 'vaga', data: {} }, ok), /inválido/);
    await assert.rejects(() => processarEmbedding({ name: 'outro', data: { vagaId: 'v1' } }, ok), /inválido/);
    const falha = (async () => new Response('erro', { status: 503 })) as typeof fetch;
    await assert.rejects(() => processarMatch({ name: 'candidato', data: { candidatoId: 'c1' } }, falha, {}), /503/);
  });
});
