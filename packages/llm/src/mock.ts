import type { LlmProvider, PedidoLlm, RespostaLlm } from './tipos';

/** Resposta estável a partir do pedido. Não usa rede. */
export class LlmMock implements LlmProvider {
  async complete(pedido: PedidoLlm): Promise<RespostaLlm> {
    const usuario = pedido.mensagens.find((mensagem) => mensagem.role === 'user')?.content ?? '';
    if (/tarefa:\s*avaliar_triagem/.test(usuario)) {
      return {
        texto: JSON.stringify({
          nota: 8,
          criterios: { clareza: 8, profundidade: 7, resultado: 8 },
          justificativa: 'A resposta aborda o tema com exemplo objetivo.',
          confianca: 0.9,
        }),
        modelo: 'mock-deterministico',
        provedor: 'mock',
      };
    }
    const faltantes = Math.max(0, Number(/faltantes:\s*(\d+)/.exec(usuario)?.[1] ?? 0));
    const titulo = /titulo:\s*(.+)/.exec(usuario)?.[1]?.trim() || 'a vaga';
    const tema = /arquitet/i.test(titulo) ? 'decisão de arquitetura e trade-off' : 'desafio técnico da função';
    const perguntas = Array.from({ length: faltantes }, (_, indice) => ({
      enunciado: `Pergunta ${indice + 1} sobre ${titulo}: conte uma ${tema} que você conduziu.`,
      rubrica: { criterios: ['clareza', 'profundidade', 'resultado'] },
      tempoLimiteSegundos: 180,
    }));
    return {
      texto: JSON.stringify({ perguntas }),
      modelo: 'mock-deterministico',
      provedor: 'mock',
    };
  }
}
