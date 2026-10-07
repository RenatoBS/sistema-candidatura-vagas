import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { EVENTO_LIMPAR_DISPOSITIVOS, processarNotificacao } from './notificacoes-jobs';

describe('jobs de notificação', () => {
  it('match.forte chama a API interna com o token', async () => {
    const urls: string[] = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      urls.push(url);
      assert.equal((init?.headers as Record<string, string>)['x-internal-token'], 'segredo');
      return new Response(JSON.stringify({ notificadas: 1 }), { status: 200 });
    }) as typeof fetch;
    const env = { API_PUBLIC_URL: 'http://api.local', INTERNAL_JOB_TOKEN: 'segredo' };
    await processarNotificacao({ name: 'match.forte', data: { sugestaoId: 's1' } }, fetchImpl, env);
    assert.deepEqual(urls, ['http://api.local/api/v1/interno/notificacoes/match-forte/s1']);
  });

  it('rejeita job inválido e propaga falha da API para o retry do BullMQ', async () => {
    const ok = (async () => new Response('{}', { status: 200 })) as typeof fetch;
    await assert.rejects(() => processarNotificacao({ name: 'match.forte', data: {} }, ok), /inválido/);
    await assert.rejects(() => processarNotificacao({ name: 'outro', data: { sugestaoId: 's1' } }, ok), /inválido/);
    const falha = (async () => new Response('erro', { status: 503 })) as typeof fetch;
    await assert.rejects(() => processarNotificacao({ name: 'match.forte', data: { sugestaoId: 's1' } }, falha, {}), /503/);
  });

  it('limpar-dispositivos chama a rota interna de limpeza de push', async () => {
    const urls: string[] = [];
    const fetchImpl = (async (url: string) => {
      urls.push(url);
      return new Response(JSON.stringify({ removidos: 2 }), { status: 200 });
    }) as typeof fetch;
    await processarNotificacao({ name: EVENTO_LIMPAR_DISPOSITIVOS, data: {} }, fetchImpl, { API_PUBLIC_URL: 'http://api.local' });
    assert.deepEqual(urls, ['http://api.local/api/v1/interno/dispositivos-push/limpeza']);
  });
});
