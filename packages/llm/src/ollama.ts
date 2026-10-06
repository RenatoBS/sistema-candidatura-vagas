import type { FetchLlm, LlmProvider, PedidoLlm, RespostaLlm } from './tipos';

export class LlmOllama implements LlmProvider {
  constructor(
    private readonly opcoes: {
      baseUrl: string;
      modelo: string;
      fetchImpl?: FetchLlm;
    },
  ) {}

  async complete(pedido: PedidoLlm): Promise<RespostaLlm> {
    const fetchImpl = this.opcoes.fetchImpl ?? fetchCompativel;
    const base = this.opcoes.baseUrl.replace(/\/$/, '');
    const resposta = await fetchImpl(`${base}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: this.opcoes.modelo,
        stream: false,
        format: pedido.json ? 'json' : undefined,
        messages: pedido.mensagens,
      }),
    });
    if (!resposta.ok) throw new Error(`Ollama falhou (${resposta.status})`);
    const json = (await resposta.json()) as { message?: { content?: string } };
    return {
      texto: json.message?.content ?? '',
      modelo: this.opcoes.modelo,
      provedor: 'ollama',
    };
  }
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
