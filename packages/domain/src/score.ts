/**
 * Ranqueamento (Fase 9). Pesos Q15 provisórios no ADR 0008.
 * O candidato nunca recebe estes campos.
 */

export const VERSAO_ALGORITMO_SCORE = 1;
export const DEBOUNCE_RECALCULO_MS = 2_000;

export const PESOS_PADRAO = {
  perfil: 10,
  habilidades: 25,
  curriculo: 10,
  linkedin: 2,
  triagem: 23,
  voz: 30,
} as const;

export type ChaveScore = keyof typeof PESOS_PADRAO;
export type PesosScore = Record<ChaveScore, number>;

export const CHAVES_SCORE: readonly ChaveScore[] = [
  'perfil',
  'habilidades',
  'curriculo',
  'linkedin',
  'triagem',
  'voz',
];

const CAMPO_RANKING = /^(score($|[A-Z_])|posicao|ranking|percentil|totalCandidatos)/i;

export function validarPesos(pesos: PesosScore): { ok: true } | { ok: false; codigo: 'PESOS_INVALIDOS' } {
  const soma = CHAVES_SCORE.reduce((total, chave) => total + pesos[chave], 0);
  if (CHAVES_SCORE.some((chave) => typeof pesos[chave] !== 'number' || pesos[chave] < 0)) {
    return { ok: false, codigo: 'PESOS_INVALIDOS' };
  }
  if (Math.abs(soma - 100) > 0.001) return { ok: false, codigo: 'PESOS_INVALIDOS' };
  return { ok: true };
}

export function mediaFase(
  notas: { nota: number; conta: boolean }[],
  faltantes: number,
  modo: 'ausente' | 'zerado' | 'parcial',
): { valor: number | null; sinalizado: boolean } {
  if (modo === 'ausente') return { valor: null, sinalizado: false };
  if (modo === 'zerado') return { valor: 0, sinalizado: true };
  const validas = notas.filter((item) => item.conta);
  const denominador = validas.length + faltantes;
  if (denominador === 0) return { valor: null, sinalizado: false };
  const soma = validas.reduce((total, item) => total + item.nota, 0);
  return { valor: (soma / denominador) * 10, sinalizado: faltantes > 0 };
}

export interface ComponenteCalculado {
  valor: number | null;
  peso: number;
  pesoEfetivo: number;
  sinalizado: boolean;
}

export function calcularScore(entrada: {
  componentes: Record<ChaveScore, { valor: number | null; sinalizado?: boolean }>;
  pesos: PesosScore;
}): {
  scoreFinal: number;
  completude: number;
  componentesPresentes: number;
  explicacao: { componentes: Record<ChaveScore, ComponenteCalculado>; texto: string };
} {
  const presentes = CHAVES_SCORE.filter((chave) => entrada.componentes[chave].valor !== null);
  const somaPesos = presentes.reduce((total, chave) => total + entrada.pesos[chave], 0);
  const componentes = {} as Record<ChaveScore, ComponenteCalculado>;
  let scoreFinal = 0;
  for (const chave of CHAVES_SCORE) {
    const valor = entrada.componentes[chave].valor;
    const peso = entrada.pesos[chave];
    const pesoEfetivo = valor !== null && somaPesos > 0 ? (peso / somaPesos) * 100 : 0;
    if (valor !== null && somaPesos > 0) scoreFinal += (peso * valor) / somaPesos;
    componentes[chave] = {
      valor,
      peso,
      pesoEfetivo,
      sinalizado: entrada.componentes[chave].sinalizado === true,
    };
  }
  const completude = presentes.length / CHAVES_SCORE.length;
  const texto =
    presentes.length === CHAVES_SCORE.length
      ? `${Math.round(scoreFinal)}/100 (completo)`
      : `${Math.round(scoreFinal)}/100 (parcial — ${presentes.length} de ${CHAVES_SCORE.length} componentes)`;
  return { scoreFinal, completude, componentesPresentes: presentes.length, explicacao: { componentes, texto } };
}

export function deveAguardarDebounce(ultimoEm: number | null, agora: number, janela = DEBOUNCE_RECALCULO_MS): boolean {
  return ultimoEm !== null && agora - ultimoEm < janela;
}

export function campoDeRanking(nome: string): boolean {
  return CAMPO_RANKING.test(nome);
}

export function vazarRanking(valor: unknown, acc: string[] = []): string[] {
  if (Array.isArray(valor)) {
    valor.forEach((item) => vazarRanking(item, acc));
    return acc;
  }
  if (!valor || typeof valor !== 'object') return acc;
  for (const [chave, item] of Object.entries(valor)) {
    if (campoDeRanking(chave)) acc.push(chave);
    vazarRanking(item, acc);
  }
  return acc;
}
