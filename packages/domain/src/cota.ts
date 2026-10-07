/** Cotas por tenant. Provisório (ADR 0009): valores revisáveis pelo Renato. */

export const COTAS_PADRAO = {
  apiPorMinuto: 2_000,
  iaPorHora: 500,
  vozSimultaneasPorEmpresa: 4,
} as const;

export function decidirCotaJanela(
  instantes: readonly number[],
  agoraMs: number,
  janelaMs: number,
  limite: number,
): { permitido: boolean; esperaMs: number } {
  const naJanela = instantes.filter((instante) => agoraMs - instante < janelaMs && agoraMs >= instante);
  if (naJanela.length < limite) return { permitido: true, esperaMs: 0 };
  const maisAntigo = Math.min(...naJanela);
  return { permitido: false, esperaMs: Math.max(0, janelaMs - (agoraMs - maisAntigo)) };
}

export function decidirCotaSimultanea(ativas: number, limite: number): 'admitir' | 'recusar' {
  return ativas >= limite ? 'recusar' : 'admitir';
}
