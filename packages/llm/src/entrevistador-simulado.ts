import type { LlmProvider, PedidoLlm, RespostaLlm } from './tipos';

const PERGUNTAS_SOFTWARE = [
  (titulo: string) =>
    `Conte uma entrega recente como ${titulo} em que o prazo apertou. O que você priorizou e qual foi o resultado?`,
  (titulo: string) =>
    `Descreva uma falha que você investigou atuando como ${titulo}. Como achou a causa e o que mudou depois?`,
  (titulo: string) =>
    `Fale de uma decisão técnica que você defendeu na vaga de ${titulo}. Qual era o trade-off e como mediu o efeito?`,
  (titulo: string) =>
    `Relate como você trabalhou com outras pessoas para destravar um problema em ${titulo}. O que ficou combinado?`,
  (titulo: string) => `O que você faria nos primeiros 30 dias nesta vaga de ${titulo}?`,
];

const PERGUNTAS_DADOS = [
  (titulo: string) =>
    `Conte uma análise como ${titulo} que mudou uma decisão. Quais dados usou e qual foi o resultado?`,
  (titulo: string) =>
    `Descreva uma métrica que você definiu ou corrigiu atuando como ${titulo}. Por que ela importava?`,
  (titulo: string) =>
    `Fale de um problema de qualidade de dados que você enfrentou em ${titulo}. Como detectou e o que fez?`,
  (titulo: string) =>
    `Relate como você explicou um número difícil para alguém de outra área, no papel de ${titulo}.`,
  (titulo: string) => `O que você investigaria primeiro nos 30 dias iniciais desta vaga de ${titulo}?`,
];

/**
 * Entrevistador determinístico para o simulador de desenvolvimento.
 * Não usa rede: sugere perguntas da vaga e reage ao texto da resposta na avaliação.
 */
export class LlmEntrevistadorSimulado implements LlmProvider {
  async complete(pedido: PedidoLlm): Promise<RespostaLlm> {
    const usuario = pedido.mensagens.find((mensagem) => mensagem.role === 'user')?.content ?? '';
    const texto = /tarefa:\s*avaliar_triagem/.test(usuario)
      ? JSON.stringify(avaliar(usuario))
      : JSON.stringify({ perguntas: sugerir(usuario) });
    return { texto, modelo: 'entrevistador-simulado', provedor: 'mock' };
  }
}

function sugerir(usuario: string): Array<{ enunciado: string; rubrica: { criterios: string[] }; tempoLimiteSegundos: number }> {
  const faltantes = Math.max(0, Number(/faltantes:\s*(\d+)/.exec(usuario)?.[1] ?? 0));
  const titulo = /titulo:\s*(.+)/.exec(usuario)?.[1]?.trim() || 'a vaga';
  const banco = /dados|analista|cientista|métrica|metrica/i.test(titulo) ? PERGUNTAS_DADOS : PERGUNTAS_SOFTWARE;
  return Array.from({ length: faltantes }, (_, indice) => {
    const montar =
      banco[indice % banco.length] ?? ((rotulo: string) => `Conte um exemplo da sua atuação como ${rotulo}.`);
    return {
      enunciado: montar(titulo),
      rubrica: { criterios: ['clareza', 'profundidade', 'resultado'] },
      tempoLimiteSegundos: 180,
    };
  });
}

function avaliar(usuario: string): {
  nota: number;
  criterios: Record<string, number>;
  justificativa: string;
  confianca: number;
} {
  const conteudo = extrairResposta(usuario);
  const nota = pontuar(conteudo);
  const trecho = conteudo.replace(/\s+/g, ' ').trim().slice(0, 160);
  return {
    nota,
    criterios: {
      clareza: nota,
      profundidade: Math.max(0, nota - 1),
      resultado: Math.min(10, nota),
    },
    justificativa: reagir(trecho, nota),
    confianca: Math.min(0.95, 0.55 + nota / 20),
  };
}

function extrairResposta(usuario: string): string {
  const marcado = /<resposta_candidato>\s*([\s\S]*?)\s*<\/resposta_candidato>/.exec(usuario);
  return (marcado?.[1] ?? '').trim();
}

/** Nota estável a partir do tamanho e de sinais concretos. A mesma resposta gera a mesma nota. */
export function pontuar(texto: string): number {
  const palavras = texto.split(/\s+/).filter(Boolean).length;
  let nota = 3;
  if (palavras >= 8) nota = 5;
  if (palavras >= 18) nota = 7;
  if (palavras >= 32) nota = 8;
  if (/\d/.test(texto)) nota += 1;
  if (/resultado|prazo|equipe|causa|métrica|metrica|entreg/i.test(texto)) nota += 1;
  return Math.max(0, Math.min(10, nota));
}

function reagir(trecho: string, nota: number): string {
  if (!trecho) return 'A resposta chegou vazia. Não há exemplo para comentar.';
  if (nota >= 8) {
    return `A resposta traz um exemplo concreto (“${trecho}”). Dá para ver o que foi feito e o efeito.`;
  }
  if (nota >= 6) {
    return `A resposta cobre o tema (“${trecho}”), e ainda cabe mais detalhe sobre o resultado.`;
  }
  return `A resposta ficou curta (“${trecho}”). Faltou um exemplo com contexto e resultado.`;
}
