import type { PerguntaSugerida } from '@scv/llm';

function normalizar(texto: string): Set<string> {
  const palavras = texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((palavra) => palavra.length > 2);
  return new Set(palavras);
}

/** Similaridade de Jaccard entre os conjuntos de palavras (0 a 1). */
export function similaridadeEnunciados(a: string, b: string): number {
  const conjuntoA = normalizar(a);
  const conjuntoB = normalizar(b);
  if (conjuntoA.size === 0 || conjuntoB.size === 0) return 0;
  let comuns = 0;
  for (const palavra of conjuntoA) if (conjuntoB.has(palavra)) comuns += 1;
  return comuns / (conjuntoA.size + conjuntoB.size - comuns);
}

export const LIMIAR_QUASE_IGUAL = 0.7;

/**
 * Mantém só sugestões diferentes entre si e das perguntas já existentes (aprovadas ou pendentes),
 * limitadas ao número de vagas livres na etapa.
 */
export function selecionarSugestoes(
  geradas: PerguntaSugerida[],
  existentes: string[],
  faltantes: number,
): PerguntaSugerida[] {
  const aceitas: PerguntaSugerida[] = [];
  for (const candidata of geradas) {
    if (aceitas.length >= faltantes) break;
    const repetida = [...existentes, ...aceitas.map((item) => item.enunciado)].some(
      (enunciado) => similaridadeEnunciados(enunciado, candidata.enunciado) >= LIMIAR_QUASE_IGUAL,
    );
    if (!repetida) aceitas.push(candidata);
  }
  return aceitas;
}
