import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { processarExclusaoLgpd } from './lgpd-jobs';

const env = { API_PUBLIC_URL: 'http://api.local', INTERNAL_JOB_TOKEN: 'segredo' };

describe('job de exclusão LGPD', () => {
  it('chama a rota interna e devolve o relatório quando conclui', async () => {
    const urls: string[] = [];
    const fetchImpl = (async (url: string) => {
      urls.push(url);
      return new Response(JSON.stringify({ concluida: true, relatorio: { arquivosRemovidos: 2 } }), { status: 200 });
    }) as typeof fetch;
    const resultado = (await processarExclusaoLgpd('s1', fetchImpl, env)) as { concluida: boolean };
    assert.equal(resultado.concluida, true);
    assert.deepEqual(urls, ['http://api.local/api/v1/interno/lgpd/exclusoes/s1/processar']);
  });

  it('falha (para repetir com backoff) enquanto restarem arquivos pendentes', async () => {
    const fetchImpl = (async () => new Response(JSON.stringify({ concluida: false, pendentes: 1 }), { status: 200 })) as typeof fetch;
    await assert.rejects(() => processarExclusaoLgpd('s1', fetchImpl, env), /1 arquivo/);
  });
});
