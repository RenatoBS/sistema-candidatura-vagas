export interface PoliticaInatividade {
  prazoInatividadeHoras: number;
  lembreteInatividadeHoras: number;
}

export const POLITICA_INATIVIDADE_PADRAO: PoliticaInatividade = {
  prazoInatividadeHoras: 24,
  lembreteInatividadeHoras: 12,
};

export type ResultadoInatividade = 'NENHUMA' | 'LEMBRETE' | 'ABANDONAR';

export interface EntrevistaInatividade {
  iniciadaEm: Date | null;
  ultimaInteracaoEm: Date | null;
}

export function registrarPrimeiraResposta(
  entrevista: EntrevistaInatividade,
  agora: Date,
): EntrevistaInatividade & { tentativaConsumida: boolean } {
  const iniciadaEm = entrevista.iniciadaEm ?? agora;
  return {
    ...entrevista,
    iniciadaEm,
    ultimaInteracaoEm: agora,
    tentativaConsumida: true,
  };
}

export function podeReiniciar(entrevista: EntrevistaInatividade): boolean {
  return entrevista.iniciadaEm === null;
}

export function prazoInatividade(
  entrevista: EntrevistaInatividade,
  politica: PoliticaInatividade = POLITICA_INATIVIDADE_PADRAO,
): Date | null {
  if (!entrevista.ultimaInteracaoEm) return null;
  return new Date(
    entrevista.ultimaInteracaoEm.getTime() + politica.prazoInatividadeHoras * 60 * 60 * 1000,
  );
}

export function momentoLembreteInatividade(
  entrevista: EntrevistaInatividade,
  politica: PoliticaInatividade = POLITICA_INATIVIDADE_PADRAO,
): Date | null {
  if (!entrevista.ultimaInteracaoEm) return null;
  return new Date(
    entrevista.ultimaInteracaoEm.getTime() + politica.lembreteInatividadeHoras * 60 * 60 * 1000,
  );
}

export function avaliarInatividade(
  entrevista: EntrevistaInatividade,
  agora: Date,
  politica: PoliticaInatividade = POLITICA_INATIVIDADE_PADRAO,
): ResultadoInatividade {
  const prazo = prazoInatividade(entrevista, politica);
  if (!prazo || agora.getTime() < prazo.getTime()) {
    const lembrete = momentoLembreteInatividade(entrevista, politica);
    return lembrete && agora.getTime() >= lembrete.getTime() ? 'LEMBRETE' : 'NENHUMA';
  }
  return 'ABANDONAR';
}

export function registrarAceiteTentativa(aceiteTentativaEm: Date | null, agora: Date): Date {
  return aceiteTentativaEm ?? agora;
}
