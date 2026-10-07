export interface ResultadoStt {
  texto: string;
  confianca: number;
  duracaoSegundos: number;
  modelo: string;
}
export interface SttProvider {
  transcrever(entrada: { audio: Buffer; mimetype: string; idioma: string }): Promise<ResultadoStt>;
}
type FetchLike = typeof fetch;
export class OpenAiWhisperStt implements SttProvider {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly modelo = 'whisper-1',
    private readonly fetchImpl: FetchLike = fetch,
  ) {}
  async transcrever(entrada: {
    audio: Buffer;
    mimetype: string;
    idioma: string;
  }): Promise<ResultadoStt> {
    const form = new FormData();
    form.append('file', new Blob([entrada.audio], { type: entrada.mimetype }), 'audio');
    form.append('model', this.modelo);
    form.append('language', entrada.idioma);
    form.append('response_format', 'verbose_json');
    const resposta = await this.fetchImpl(
      `${this.baseUrl.replace(/\/$/, '')}/audio/transcriptions`,
      { method: 'POST', headers: { authorization: `Bearer ${this.apiKey}` }, body: form },
    );
    if (!resposta.ok) throw new Error(`OPENAI_STT_${resposta.status}`);
    const json = (await resposta.json()) as {
      text?: string;
      duration?: number;
      segments?: Array<{ avg_logprob?: number; no_speech_prob?: number; duration?: number }>;
    };
    const segmentos = json.segments ?? [];
    const confianca = segmentos.length
      ? segmentos.reduce(
          (s, x) =>
            s +
            Math.max(0, Math.min(1, Math.exp(x.avg_logprob ?? -1) * (1 - (x.no_speech_prob ?? 0)))),
          0,
        ) / segmentos.length
      : 0;
    return {
      texto: json.text ?? '',
      confianca,
      duracaoSegundos: json.duration ?? 0,
      modelo: this.modelo,
    };
  }
}
export class FakeSttProvider implements SttProvider {
  constructor(private readonly texto = 'resposta de teste') {}
  async transcrever(entrada: { audio: Buffer }): Promise<ResultadoStt> {
    return {
      texto: this.texto,
      confianca: 1,
      duracaoSegundos: Math.max(0, entrada.audio.length / 16000),
      modelo: 'fake',
    };
  }
}
export function criarSttProvider(env: NodeJS.ProcessEnv = process.env): SttProvider {
  return env.STT_PROVIDER === 'openai' && env.OPENAI_API_KEY
    ? new OpenAiWhisperStt(
        env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
        env.OPENAI_API_KEY,
        env.STT_MODELO ?? 'whisper-1',
      )
    : new FakeSttProvider();
}
