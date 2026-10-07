import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { criarLlmProvider } from './fabrica';
import { LlmMock } from './mock';
import { LlmOllama } from './ollama';
import { LlmOpenAi } from './openai';
import { sugerirPerguntas } from './sugerir';
import type { FetchLlm } from './tipos';

describe('LlmProvider', () => {
  it('mock é determinístico e não usa rede', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (() => {
      throw new Error('rede');
    }) as typeof fetch;
    try {
      const llm = criarLlmProvider({ LLM_PROVIDER: 'mock' });
      assert.ok(llm instanceof LlmMock);
      const primeira = await sugerirPerguntas(llm, entrada(3, 'Arquiteto de software'));
      const segunda = await sugerirPerguntas(llm, entrada(3, 'Arquiteto de software'));
      assert.equal(primeira.perguntas.length, 3);
      assert.deepEqual(primeira, segunda);
      assert.match(primeira.perguntas[0]?.enunciado ?? '', /arquitetura/i);
      assert.equal(primeira.versaoPrompt, 'sugerir-perguntas/v1');
    } finally {
      globalThis.fetch = original;
    }
  });

  it('completa só as faltantes', async () => {
    const resultado = await sugerirPerguntas(new LlmMock(), entrada(0, 'Analista'));
    assert.deepEqual(resultado.perguntas, []);
  });

  it('openai e ollama usam o fetch injetado', async () => {
    const urls: string[] = [];
    const corpos: string[] = [];
    const fetchImpl: FetchLlm = async (url, init) => {
      urls.push(url);
      corpos.push(init.body);
      const corpo = url.includes('openai')
        ? { choices: [{ message: { content: '{"perguntas":[]}' } }] }
        : { message: { content: '{"perguntas":[]}' } };
      return { ok: true, status: 200, text: async () => '', json: async () => corpo };
    };
    const schema = { type: 'object', properties: { perguntas: { type: 'array' } } };
    const openai = new LlmOpenAi({ apiKey: 'sk-teste', modelo: 'gpt-teste', fetchImpl });
    await openai.complete({ mensagens: [{ role: 'user', content: 'oi' }], json: true, schema });
    const ollama = new LlmOllama({ baseUrl: 'http://ollama.local', modelo: 'llama', fetchImpl });
    await ollama.complete({ mensagens: [{ role: 'user', content: 'oi' }], json: true, schema });
    const pedidoOpenAi = JSON.parse(corpos[0] ?? '{}') as { response_format?: { type?: string } };
    const pedidoOllama = JSON.parse(corpos[1] ?? '{}') as { format?: { type?: string } };
    assert.equal(pedidoOpenAi.response_format?.type, 'json_schema');
    assert.equal(pedidoOllama.format?.type, 'object');
    assert.deepEqual(urls, ['https://api.openai.com/v1/chat/completions', 'http://ollama.local/api/chat']);
    const fabrica = criarLlmProvider({ LLM_PROVIDER: 'openai', OPENAI_API_KEY: 'sk-teste', LLM_MODELO: 'gpt-teste' });
    assert.ok(fabrica instanceof LlmOpenAi);
    assert.ok(criarLlmProvider({ LLM_PROVIDER: 'ollama' }) instanceof LlmOllama);
  });
});

function entrada(faltantes: number, titulo: string) {
  return {
    titulo,
    descricao: 'Desenhar sistemas e orientar o time.',
    senioridade: 'SENIOR',
    modelo: 'REMOTO',
    habilidades: ['TypeScript'],
    existentes: ['Pergunta já exigida'],
    faltantes,
    tipoEtapa: 'ENTREVISTA_VOZ',
  };
}

describe('variáveis de ambiente vazias (FC-00/F11)', () => {
  async function modeloUsado(env: Parameters<typeof criarLlmProvider>[0]): Promise<string> {
    const original = globalThis.fetch;
    let corpo = '';
    globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
      corpo = String(init?.body);
      return Response.json({ choices: [{ message: { content: '{}' } }] });
    }) as typeof fetch;
    try {
      await criarLlmProvider(env).complete({ mensagens: [{ role: 'user', content: 'oi' }] });
    } finally {
      globalThis.fetch = original;
    }
    return (JSON.parse(corpo) as { model: string }).model;
  }

  it('LLM_MODELO vazio usa o modelo padrão da OpenAI', async () => {
    assert.equal(await modeloUsado({ LLM_PROVIDER: 'openai', OPENAI_API_KEY: 'chave', LLM_MODELO: '' }), 'gpt-4o-mini');
    assert.equal(await modeloUsado({ LLM_PROVIDER: 'openai', OPENAI_API_KEY: 'chave', LLM_MODELO: '   ' }), 'gpt-4o-mini');
    assert.equal(await modeloUsado({ LLM_PROVIDER: 'openai', OPENAI_API_KEY: 'chave', LLM_MODELO: 'gpt-x' }), 'gpt-x');
  });

  it('LLM_PROVIDER vazio cai no mock', () => {
    assert.ok(criarLlmProvider({ LLM_PROVIDER: '' }) instanceof LlmMock);
  });
});

