import type { FetchLlm, LlmProvider, PedidoLlm, RespostaLlm } from './tipos';

export class LlmOpenAi implements LlmProvider {
  constructor(
    private readonly opcoes: {
      apiKey: string;
      modelo: string;
      baseUrl?: string;
      fetchImpl?: FetchLlm;
    },
  ) {}

  async complete(pedido: PedidoLlm): Promise<RespostaLlm> {
    if (!this.opcoes.apiKey) throw new Error('OPENAI_API_KEY é obrigatória');
    const fetchImpl = this.opcoes.fetchImpl ?? fetchCompativel;
    const base = (this.opcoes.baseUrl ?? 'https://api.openai.com/v1').replace(/\/$/, '');
    const resposta = await fetchImpl(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.opcoes.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: this.opcoes.modelo,
        temperature: 0.2,
        response_format: formatoResposta(pedido),
        messages: pedido.mensagens,
      }),
    });
    if (!resposta.ok) {
      throw new Error(`OpenAI falhou (${resposta.status})`);
    }
    const json = (await resposta.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return {
      texto: json.choices?.[0]?.message?.content ?? '',
      modelo: this.opcoes.modelo,
      provedor: 'openai',
    };
  }
}

function formatoResposta(pedido: PedidoLlm): { type: string; json_schema?: object } | undefined {
  if (pedido.schema) {
    return {
      type: 'json_schema',
      json_schema: { name: 'resposta', strict: true, schema: semMeta(pedido.schema) },
    };
  }
  if (pedido.json) return { type: 'json_object' };
  return undefined;
}

function semMeta(schema: object): object {
  const copia = { ...(schema as Record<string, unknown>) };
  delete copia.$schema;
  return copia;
}

const fetchCompativel: FetchLlm = async (entrada, init) => {
  const resposta = await fetch(entrada, init);
  return {
    ok: resposta.ok,
    status: resposta.status,
    text: () => resposta.text(),
    json: () => resposta.json() as Promise<unknown>,
  };
};
