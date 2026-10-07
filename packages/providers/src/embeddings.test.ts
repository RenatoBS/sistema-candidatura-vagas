import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DIMENSOES_EMBEDDING, similaridadeCosseno } from '@scv/domain';

import { criarEmbeddingProvider, EmbeddingOpenAiCompativel, FakeEmbeddingProvider, type FetchEmbedding } from './embeddings';

describe('EmbeddingProvider', () => {
  it('fake é determinístico, normalizado e aproxima textos parecidos', async () => {
    const fake = new FakeEmbeddingProvider();
    const [a, b, c, a2] = await fake.gerar([
      'Desenvolvedor backend TypeScript PostgreSQL',
      'Engenheiro backend TypeScript e PostgreSQL',
      'Confeiteiro de bolos e doces finos',
      'Desenvolvedor backend TypeScript PostgreSQL',
    ]);
    assert.equal(a!.length, DIMENSOES_EMBEDDING);
    assert.deepEqual(a, a2);
    assert.ok(Math.abs(similaridadeCosseno(a!, a!) - 1) < 1e-9);
    assert.ok(similaridadeCosseno(a!, b!) > similaridadeCosseno(a!, c!));
    assert.equal(fake.chamadas.length, 1);
  });

  it('adapter OpenAI-compatível envia modelo e dimensões e valida a resposta', async () => {
    const pedidos: Array<{ url: string; body: Record<string, unknown>; auth?: string }> = [];
    const fetchImpl: FetchEmbedding = async (url, init) => {
      pedidos.push({ url, body: JSON.parse(init.body) as Record<string, unknown>, auth: init.headers.authorization });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            { index: 1, embedding: new Array(4).fill(0.5) },
            { index: 0, embedding: new Array(4).fill(0.1) },
          ],
        }),
      };
    };
    const provider = new EmbeddingOpenAiCompativel({ apiKey: 'k', baseUrl: 'http://emb.local/v1/', dimensoes: 4, fetchImpl });
    const vetores = await provider.gerar(['a', 'b']);
    assert.equal(pedidos[0]?.url, 'http://emb.local/v1/embeddings');
    assert.equal(pedidos[0]?.auth, 'Bearer k');
    assert.deepEqual(pedidos[0]?.body, { model: 'text-embedding-3-small', input: ['a', 'b'], dimensions: 4 });
    assert.equal(vetores[0]?.[0], 0.1);

    const errada = new EmbeddingOpenAiCompativel({
      dimensoes: 8,
      fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ data: [{ index: 0, embedding: [1, 2] }] }) }),
    });
    await assert.rejects(() => errada.gerar(['x']), /8 dimensões/);
    const falha = new EmbeddingOpenAiCompativel({ fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({}) }) });
    await assert.rejects(() => falha.gerar(['x']), /503/);
  });

  it('fábrica usa fake sem credenciais e respeita EMBEDDING_PROVIDER', () => {
    assert.equal(criarEmbeddingProvider({}).provedor, 'fake');
    assert.equal(criarEmbeddingProvider({ OPENAI_API_KEY: 'k' }).provedor, 'openai');
    assert.equal(criarEmbeddingProvider({ EMBEDDING_BASE_URL: 'http://ollama:11434/v1' }).provedor, 'openai');
    assert.equal(criarEmbeddingProvider({ OPENAI_API_KEY: 'k', EMBEDDING_PROVIDER: 'fake' }).provedor, 'fake');
  });
});
