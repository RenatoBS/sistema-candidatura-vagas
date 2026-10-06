import { readFileSync } from 'node:fs';

import type { PocConfig } from '../config';

const TRANSCRICAO_FIXTURE =
  'Tenho cinco anos de experiência em desenvolvimento de software e liderança de equipes pequenas.';

export interface ResultadoStt {
  texto: string;
  provedor: string;
}

export async function transcreverAudio(config: PocConfig, caminhoAudio: string): Promise<ResultadoStt> {
  if (config.mock) {
    await simularLatencia(120, 40);
    return { texto: TRANSCRICAO_FIXTURE, provedor: 'mock' };
  }

  if (!config.openai.apiKey) {
    throw new Error('OPENAI_API_KEY é obrigatória para STT (modos openai/hibrido).');
  }

  const audio = readFileSync(caminhoAudio);
  const form = new FormData();
  form.append('file', new Blob([audio], { type: 'audio/wav' }), 'audio.wav');
  form.append('model', config.openai.sttModel);
  form.append('language', 'pt');

  const res = await fetch(`${config.openai.baseUrl}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.openai.apiKey}` },
    body: form,
  });

  if (!res.ok) {
    const corpo = await res.text();
    throw new Error(`STT falhou (${res.status}): ${corpo}`);
  }

  const json = (await res.json()) as { text: string };
  return { texto: json.text.trim(), provedor: `openai/${config.openai.sttModel}` };
}

async function simularLatencia(baseMs: number, jitterMs: number): Promise<void> {
  const atraso = baseMs + Math.random() * jitterMs;
  await new Promise((r) => setTimeout(r, atraso));
}
