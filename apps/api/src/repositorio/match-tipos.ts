import type { HabilidadeCandidatoMatch, StatusVaga } from '@scv/domain';

export type StatusSugestaoMatch = 'PENDENTE' | 'NOTIFICADA' | 'CONVIDADA' | 'ACEITA' | 'RECUSADA' | 'EXPIRADA';

export interface SugestaoMatchRegistro {
  id: string;
  vagaId: string;
  candidatoId: string;
  compatibilidade: number;
  explicacao: Record<string, unknown>;
  status: StatusSugestaoMatch;
  /** Preenchido por F6-06 quando a notificação MATCH_FORTE sai de fato. */
  notificadoEm: Date | null;
  criadoEm: Date;
  atualizadoEm: Date;
}

/** Candidato visível para match, com embedding e todas as habilidades obrigatórias da vaga. */
export interface CandidatoSimilar {
  candidatoId: string;
  similaridade: number;
  habilidades: HabilidadeCandidatoMatch[];
}

/** Vaga PUBLICADA dentro do prazo, com embedding, cujas obrigatórias o candidato atende. */
export interface VagaSimilar {
  vagaId: string;
  empresaId: string;
  status: StatusVaga;
  prazoInscricoes: Date | null;
  similaridade: number;
}

export interface EntradaSugestaoMatch {
  vagaId: string;
  candidatoId: string;
  compatibilidade: number;
  explicacao: Record<string, unknown>;
  forte: boolean;
  agora: Date;
}

export interface ResultadoSugestaoMatch {
  sugestao: SugestaoMatchRegistro;
  /** `true` só na primeira vez que a sugestão passa de PENDENTE para NOTIFICADA (dedup por vaga+candidato). */
  tornouForte: boolean;
}
