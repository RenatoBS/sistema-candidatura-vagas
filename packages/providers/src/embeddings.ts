import { DIMENSOES_EMBEDDING } from '@scv/domain';

export interface EmbeddingProvider {
  readonly provedor: 'fake' | 'openai';
  readonly modelo: string;
  readonly dimensoes: number;
  /** Um vetor por texto, na mesma ordem. */
  gerar(textos: string[]): Promise<number[][]>;
}

/**
 * Determinístico e sem rede: bag-of-words com hashing (FNV-1a) em `dimensoes`
 * posições, normalizado. Textos com palavras em comum ficam próximos no cosseno,
 * o que basta para testar o match de ponta a ponta.
 */
export class FakeEmbeddingProvider implements EmbeddingProvider {
  readonly provedor = 'fake' as const;
  readonly modelo = 'fake-bow-v1';
  readonly chamadas: string[][] = [];

  constructor(readonly dimensoes: number = DIMENSOES_EMBEDDING) {}

  async gerar(textos: string[]): Promise<number[][]> {
    this.chamadas.push([...textos]);
    return textos.map((texto) => this.vetor(texto));
  }

  limpar(): void {
    this.chamadas.length = 0;
  }

  private vetor(texto: string): number[] {
    const vetor = new Array<number>(this.dimensoes).fill(0);
    for (const token of tokens(texto)) {
      const hash = fnv1a(token);
      vetor[hash % this.dimensoes]! += (hash >>> 31) & 1 ? -1 : 1;
    }
    const norma = Math.sqrt(vetor.reduce((soma, valor) => soma + valor * valor, 0));
    return norma === 0 ? vetor : vetor.map((valor) => valor / norma);
  }
}

export type FetchEmbedding = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/** Endpoint `/embeddings` compatível com a API da OpenAI (OpenAI, Azure, vLLM, Ollama etc.). */
export class EmbeddingOpenAiCompativel implements EmbeddingProvider {
  readonly provedor = 'openai' as const;
  readonly modelo: string;
  readonly dimensoes: number;

  constructor(
    private readonly opcoes: {
      apiKey?: string;
      baseUrl?: string;
      modelo?: string;
      dimensoes?: number;
      fetchImpl?: FetchEmbedding;
    },
  ) {
    this.modelo = opcoes.modelo || 'text-embedding-3-small';
    this.dimensoes = opcoes.dimensoes ?? DIMENSOES_EMBEDDING;
  }

  async gerar(textos: string[]): Promise<number[][]> {
    if (textos.length === 0) return [];
    const base = (this.opcoes.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (this.opcoes.apiKey) headers.authorization = `Bearer ${this.opcoes.apiKey}`;
    const fetchImpl = this.opcoes.fetchImpl ?? (fetch as unknown as FetchEmbedding);
    const resposta = await fetchImpl(`${base}/embeddings`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model: this.modelo, input: textos, dimensions: this.dimensoes }),
    });
    if (!resposta.ok) throw new Error(`embeddings falhou (${resposta.status})`);
    const corpo = (await resposta.json()) as { data?: Array<{ index?: number; embedding?: unknown }> };
    const itens = [...(corpo.data ?? [])].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    if (itens.length !== textos.length) throw new Error('embeddings: quantidade de vetores inesperada');
    return itens.map((item) => {
      const vetor = item.embedding;
      if (!Array.isArray(vetor) || vetor.length !== this.dimensoes || !vetor.every((valor) => typeof valor === 'number')) {
        throw new Error(`embeddings: vetor precisa ter ${this.dimensoes} dimensões`);
      }
      return vetor as number[];
    });
  }
}

export interface AmbienteEmbedding {
  EMBEDDING_PROVIDER?: string;
  EMBEDDING_BASE_URL?: string;
  EMBEDDING_API_KEY?: string;
  EMBEDDING_MODELO?: string;
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
}

/**
 * `EMBEDDING_PROVIDER=fake|openai` decide explicitamente. Sem ele, usa o adapter
 * OpenAI-compatível quando há `EMBEDDING_BASE_URL` ou `OPENAI_API_KEY`; senão, o fake.
 */
export function criarEmbeddingProvider(env: AmbienteEmbedding = process.env): EmbeddingProvider {
  const escolhido = env.EMBEDDING_PROVIDER?.toLowerCase();
  const externo = escolhido ? escolhido === 'openai' : Boolean(env.EMBEDDING_BASE_URL || env.OPENAI_API_KEY);
  if (!externo) return new FakeEmbeddingProvider();
  return new EmbeddingOpenAiCompativel({
    apiKey: env.EMBEDDING_API_KEY || env.OPENAI_API_KEY,
    baseUrl: env.EMBEDDING_BASE_URL || env.OPENAI_BASE_URL,
    modelo: env.EMBEDDING_MODELO,
  });
}

function tokens(texto: string): string[] {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9+#]+/)
    .filter((token) => token.length > 1);
}

function fnv1a(texto: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < texto.length; i += 1) {
    hash ^= texto.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}
