import type { PocConfig } from '../config';

export interface ResultadoTts {
  audio: Buffer;
  provedor: string;
  primeiroAudioMs: number;
  totalMs: number;
}

export async function sintetizarFala(config: PocConfig, texto: string): Promise<ResultadoTts> {
  const inicio = performance.now();

  if (config.mock) {
    await simularLatencia(140, 50);
    const primeiroAudioMs = 160;
    const audio = Buffer.alloc(4096, 0);
    return {
      audio,
      provedor: 'mock',
      primeiroAudioMs,
      totalMs: performance.now() - inicio,
    };
  }

  if (!config.openai.apiKey) {
    throw new Error('OPENAI_API_KEY é obrigatória para TTS (modos openai/hibrido).');
  }

  const res = await fetch(`${config.openai.baseUrl}/audio/speech`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.openai.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.openai.ttsModel,
      voice: config.openai.ttsVoice,
      input: texto,
      response_format: 'wav',
    }),
  });

  if (!res.ok) {
    const corpo = await res.text();
    throw new Error(`TTS falhou (${res.status}): ${corpo}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const audio = Buffer.from(arrayBuffer);
  const totalMs = performance.now() - inicio;

  return {
    audio,
    provedor: `openai/${config.openai.ttsModel}`,
    primeiroAudioMs: totalMs,
    totalMs,
  };
}

async function simularLatencia(baseMs: number, jitterMs: number): Promise<void> {
  await new Promise((r) => setTimeout(r, baseMs + Math.random() * jitterMs));
}
