export type ProvedorLlm = 'mock' | 'openai' | 'ollama';

export interface MensagemLlm {
  role: 'system' | 'user';
  content: string;
}

export interface PedidoLlm {
  mensagens: MensagemLlm[];
  json?: boolean;
}

export interface RespostaLlm {
  texto: string;
  modelo: string;
  provedor: ProvedorLlm;
}

export interface LlmProvider {
  complete(pedido: PedidoLlm): Promise<RespostaLlm>;
}

export interface FetchLlm {
  (entrada: string, init: { method: string; headers: Record<string, string>; body: string }): Promise<{
    ok: boolean;
    status: number;
    text: () => Promise<string>;
    json: () => Promise<unknown>;
  }>;
}
