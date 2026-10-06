import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { aplicarEventoVaga, encerrarInscricoesVaga, reconciliarVagas, sugerirPerguntasVaga } from './vagas-jobs';

describe('jobs de vaga', () => {
  it('chama a API interna sem rede real', async () => {
    const urls: string[] = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      urls.push(url);
      assert.equal((init?.headers as Record<string, string>)['x-internal-token'], 'segredo');
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as typeof fetch;
    const env = { API_PUBLIC_URL: 'http://api.local', INTERNAL_JOB_TOKEN: 'segredo' };
    await encerrarInscricoesVaga('vaga-1', fetchImpl, env);
    await reconciliarVagas(fetchImpl, env);
    await sugerirPerguntasVaga('etapa-1', fetchImpl, env);
    await aplicarEventoVaga('evento-1', fetchImpl, env);
    assert.deepEqual(urls, [
      'http://api.local/api/v1/interno/vagas/vaga-1/encerrar-inscricoes',
      'http://api.local/api/v1/interno/vagas/reconciliar',
      'http://api.local/api/v1/interno/etapas/etapa-1/sugerir',
      'http://api.local/api/v1/interno/eventos-vaga/evento-1/aplicar',
    ]);
  });

  it('falha quando a API recusa o job', async () => {
    const fetchImpl = (async () => new Response('nao', { status: 500 })) as typeof fetch;
    await assert.rejects(() => reconciliarVagas(fetchImpl, { API_PUBLIC_URL: 'http://api.local' }));
  });
});