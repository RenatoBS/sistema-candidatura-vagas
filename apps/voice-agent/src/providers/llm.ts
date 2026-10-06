import type { PocConfig } from '../config';

export interface ResultadoLlm {
  texto: string;
  provedor: string;
  primeiroTokenMs: number;
  totalMs: number;
}

export async function gerarResposta(config: PocConfig, transcricao: string): Promise<ResultadoLlm> {
  const inicio = performance.now();

  if (config.mock) {
    await simularLatencia(280, 80);
    const primeiroTokenMs = 320;
    const texto =
      'Ótimo, obrigado por compartilhar. Pode me contar um desafio técnico que você resolveu recentemente?';
    return {
      texto,
      provedor: 'mock',
      primeiroTokenMs,
      totalMs: performance.now() - inicio,
    };
  }

  const usarOllama = config.modo === 'hibrido';
  if (usarOllama) {
    return await gerarComOllama(config, transcricao, inicio);
  }

  return await gerarComOpenAi(config, transcricao, inicio);
}

async function gerarComOpenAi(
  config: PocConfig,
  transcricao: string,
  inicio: number,
): Promise<ResultadoLlm> {
  if (!config.openai.apiKey) {
    throw new Error('OPENAI_API_KEY é obrigatória para LLM no modo openai.');
  }

  const res = await fetch(`${config.openai.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.openai.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.openai.llmModel,
      stream: true,
      max_tokens: 120,
      messages: [
        { role: 'system', content: config.systemPrompt },
        {
          role: 'user',
          content: `O candidato respondeu na entrevista: "${transcricao}". Faça um follow-up curto (máx. 2 frases).`,
        },
      ],
    }),
  });

  if (!res.ok || !res.body) {
    const corpo = await res.text();
    throw new Error(`LLM falhou (${res.status}): ${corpo}`);
  }

  let texto = '';
  let primeiroTokenMs = 0;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    for (const linha of chunk.split('\n')) {
      if (!linha.startsWith('data: ')) continue;
      const payload = linha.slice(6).trim();
      if (payload === '[DONE]') continue;

      try {
        const parsed = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const delta = parsed.choices?.[0]?.delta?.content ?? '';
        if (delta) {
          if (!primeiroTokenMs) primeiroTokenMs = performance.now() - inicio;
          texto += delta;
        }
      } catch {
        // ignora chunks parciais do SSE
      }
    }
  }

  return {
    texto: texto.trim(),
    provedor: `openai/${config.openai.llmModel}`,
    primeiroTokenMs: primeiroTokenMs || performance.now() - inicio,
    totalMs: performance.now() - inicio,
  };
}

async function gerarComOllama(
  config: PocConfig,
  transcricao: string,
  inicio: number,
): Promise<ResultadoLlm> {
  const res = await fetch(`${config.ollama.baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.ollama.model,
      stream: true,
      messages: [
        { role: 'system', content: config.systemPrompt },
        {
          role: 'user',
          content: `O candidato respondeu: "${transcricao}". Faça um follow-up curto.`,
        },
      ],
    }),
  });

  if (!res.ok || !res.body) {
    const corpo = await res.text();
    throw new Error(`Ollama falhou (${res.status}): ${corpo}`);
  }

  let texto = '';
  let primeiroTokenMs = 0;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    for (const linha of chunk.split('\n').filter(Boolean)) {
      try {
        const parsed = JSON.parse(linha) as {
          message?: { content?: string };
        };
        const delta = parsed.message?.content ?? '';
        if (delta) {
          if (!primeiroTokenMs) primeiroTokenMs = performance.now() - inicio;
          texto += delta;
        }
      } catch {
        // ignora
      }
    }
  }

  return {
    texto: texto.trim(),
    provedor: `ollama/${config.ollama.model}`,
    primeiroTokenMs: primeiroTokenMs || performance.now() - inicio,
    totalMs: performance.now() - inicio,
  };
}

async function simularLatencia(baseMs: number, jitterMs: number): Promise<void> {
  await new Promise((r) => setTimeout(r, baseMs + Math.random() * jitterMs));
}
