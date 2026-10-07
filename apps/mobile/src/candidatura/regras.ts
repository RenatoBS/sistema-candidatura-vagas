export function rotuloStatus(status: string | undefined, fase?: string | null): string {
  return fase || status || '—';
}

export const CONSENTIMENTOS_CANDIDATURA = [{ tipo: 'TERMOS', concedido: true, versaoTermo: '2026-10-06' }];

/** Convite pendente (candidatura CONVIDADA) para a vaga, se houver. */
export function conviteDaVaga<T extends { vaga?: { id: string } }>(convites: T[], vagaId: string): T | null {
  return convites.find((convite) => convite.vaga?.id === vagaId) ?? null;
}

export function filtrarNaoLidas<T extends { lida?: boolean; lidoEm?: string | null }>(
  itens: T[],
): T[] {
  return itens.filter((item) => item.lida === false || !item.lidoEm);
}

export function rotuloNotificacao(tipo: string): string {
  const mapa: Record<string, string> = {
    CANDIDATO_NOVO: 'Novo candidato',
    MATCH_FORTE: 'Match forte',
    CONVITE_MATCH: 'Convite de match',
  };
  return mapa[tipo] ?? 'Notificação';
}

// Regra de privacidade: dados do candidato nunca incluem score, posição ou percentil.
export function dadosPublicosCandidato<T extends Record<string, unknown>>(dados: T): Partial<T> {
  const copia = { ...dados };
  for (const chave of [
    'score',
    'pontuacao',
    'posicao',
    'percentil',
    'totalCandidatos',
    'compatibilidade',
  ])
    delete copia[chave];
  return copia;
}
