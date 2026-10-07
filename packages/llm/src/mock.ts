import type { LlmProvider, PedidoLlm, RespostaLlm } from './tipos';

const ABERTURAS = [
  'Conte uma situação real em que você resolveu um problema complexo como',
  'Descreva como você prioriza entregas e prazos atuando como',
  'Explique uma falha em produção que você investigou e corrigiu em',
  'Fale sobre uma decisão difícil de qualidade que você defendeu na posição de',
  'Relate um conflito técnico com colegas e como o resolveu trabalhando como',
  'Mostre como você mede o resultado do seu trabalho em',
  'Diga o que aprendeu com um projeto que não saiu como esperado em',
  'Compartilhe uma melhoria de processo que você liderou durante a atuação em',
];

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
      enunciado: `${ABERTURAS[indice % ABERTURAS.length]} ${titulo} (${tema}).`,
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
