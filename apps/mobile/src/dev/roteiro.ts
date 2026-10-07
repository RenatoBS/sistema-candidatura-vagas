export const RESPOSTAS_ROTEIRO = [
  'No último trimestre priorizei um incidente com a equipe. Isolamos a causa numa consulta lenta e o tempo caiu de 4 segundos para 200 milissegundos. Documentei o resultado.',
  'Trabalhei com TypeScript e React. Quando o prazo apertou, cortei escopo com o time e 80 por cento dos usuários passaram a usar a tela nova na primeira semana.',
  'Nos primeiros 30 dias eu mapearia o fluxo atual, falaria com quem usa o produto e entregaria uma melhoria pequena com o resultado medido.',
];

/** Próximo texto do candidato. Se o sistema ainda pede texto no lugar do áudio, repete a última resposta. */
export function textoDoRoteiro(entrada: {
  ultimaSaida: string;
  indice: number;
  ultimoTextoEnviado: string | null;
}): { texto: string; indice: number } {
  if (/pode responder em texto/i.test(entrada.ultimaSaida) && entrada.ultimoTextoEnviado) {
    return { texto: entrada.ultimoTextoEnviado, indice: entrada.indice };
  }
  const texto = RESPOSTAS_ROTEIRO[Math.min(entrada.indice, RESPOSTAS_ROTEIRO.length - 1)] ?? RESPOSTAS_ROTEIRO[0] ?? '';
  return { texto, indice: entrada.indice + 1 };
}
