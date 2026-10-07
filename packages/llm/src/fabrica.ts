import { envOu } from '@scv/env';
import { LlmMock } from './mock';
import { LlmOllama } from './ollama';
import { LlmOpenAi } from './openai';
import type { LlmProvider } from './tipos';

export interface AmbienteLlm {
  LLM_PROVIDER?: string;
  LLM_MODELO?: string;
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
  OLLAMA_BASE_URL?: string;
}

export function criarLlmProvider(env: AmbienteLlm = process.env): LlmProvider {
  const provedor = (envOu(env, 'LLM_PROVIDER', 'mock')).toLowerCase();
  if (provedor === 'openai') {
    return new LlmOpenAi({
      apiKey: envOu(env, 'OPENAI_API_KEY', ''),
      modelo: envOu(env, 'LLM_MODELO', 'gpt-4o-mini'),
      baseUrl: env.OPENAI_BASE_URL,
    });
  }
  if (provedor === 'ollama') {
    return new LlmOllama({
      baseUrl: envOu(env, 'OLLAMA_BASE_URL', 'http://localhost:11434'),
      modelo: envOu(env, 'LLM_MODELO', 'llama3.1'),
    });
  }
  return new LlmMock();
}
