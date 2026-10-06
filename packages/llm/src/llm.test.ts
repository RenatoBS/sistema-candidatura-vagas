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
    const fetchImpl: FetchLlm = async (url) => {
      urls.push(url);
      const corpo = url.includes('openai')
        ? { choices: [{ message: { content: '{"perguntas":[]}' } }] }
        : { message: { content: '{"perguntas":[]}' } };
      return { ok: true, status: 200, text: async () => '', json: async () => corpo };
    };
    const openai = new LlmOpenAi({ apiKey: 'sk-teste', modelo: 'gpt-teste', fetchImpl });
    await openai.complete({ mensagens: [{ role: 'user', content: 'oi' }], json: true });
    const ollama = new LlmOllama({ baseUrl: 'http://ollama.local', modelo: 'llama', fetchImpl });
    await ollama.complete({ mensagens: [{ role: 'user', content: 'oi' }], json: true });
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
