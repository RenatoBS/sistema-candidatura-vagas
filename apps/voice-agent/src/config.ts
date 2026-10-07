import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { envOu } from '@scv/env';
import type { PocModo } from './types';

const ROOT = path.join(__dirname, '..');

function carregarEnvLocal(): void {
  const envPath = path.resolve(ROOT, '.env');
  if (!existsSync(envPath)) return;

  const conteudo = readFileSync(envPath, 'utf-8');
  for (const linha of conteudo.split('\n')) {
    const trimmed = linha.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const chave = trimmed.slice(0, eq).trim();
    const valor = trimmed.slice(eq + 1).trim();
    if (!process.env[chave]) {
      process.env[chave] = valor;
    }
  }
}

carregarEnvLocal();

export interface PocConfig {
  modo: PocModo;
  fixtureAudio: string;
  systemPrompt: string;
  openai: {
    apiKey: string;
    baseUrl: string;
    sttModel: string;
    llmModel: string;
    ttsModel: string;
    ttsVoice: string;
  };
  ollama: {
    baseUrl: string;
    model: string;
  };
  mock: boolean;
}

export function carregarConfig(argv: string[]): PocConfig {
  const mockFlag = argv.includes('--mock');
  const modoEnv = (envOu(process.env, 'POC_MODO', 'mock')) as PocModo;
  const modo: PocModo = mockFlag ? 'mock' : modoEnv;

  return {
    modo,
    fixtureAudio: path.resolve(ROOT, envOu(process.env, 'POC_AUDIO_FIXTURE', 'fixtures/pergunta-candidato.wav')),
    systemPrompt:
      envOu(
        process.env,
        'POC_SYSTEM_PROMPT',
        'Você é um entrevistador de RH. Responda em português do Brasil, em uma frase curta e natural.',
      ),
    openai: {
      apiKey: envOu(process.env, 'OPENAI_API_KEY', ''),
      baseUrl: envOu(process.env, 'OPENAI_BASE_URL', 'https://api.openai.com/v1'),
      sttModel: envOu(process.env, 'OPENAI_STT_MODEL', 'whisper-1'),
      llmModel: envOu(process.env, 'OPENAI_LLM_MODEL', 'gpt-4o-mini'),
      ttsModel: envOu(process.env, 'OPENAI_TTS_MODEL', 'tts-1'),
      ttsVoice: envOu(process.env, 'OPENAI_TTS_VOICE', 'nova'),
    },
    ollama: {
      baseUrl: envOu(process.env, 'OLLAMA_BASE_URL', 'http://localhost:11434'),
      model: envOu(process.env, 'OLLAMA_MODEL', 'llama3.2'),
    },
    mock: modo === 'mock',
  };
}
