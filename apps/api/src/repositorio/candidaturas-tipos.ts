import type { StatusCandidatura } from '@scv/domain';

export type OrigemCandidatura = 'DIRETA' | 'MATCH';

export interface CandidaturaRegistro {
  id: string;
  empresaId: string;
  vagaId: string;
  candidatoId: string;
  origem: OrigemCandidatura;
  status: StatusCandidatura;
  statusAntesDaEspera: StatusCandidatura | null;
  etapaAtualId: string | null;
  criadoEm: Date;
  atualizadoEm: Date;
}

export interface HistoricoStatusRegistro {
  id: string;
  candidaturaId: string;
  /** `NOVA` na criação. */
  de: string;
  para: StatusCandidatura;
  autorId: string | null;
  motivo: string | null;
  criadoEm: Date;
}

/**
 * Controle otimista: só grava se a candidatura ainda está em `esperado`.
 * `atualizadoEm` evita ABA (ex.: pausa e retomada entre a leitura e a escrita).
 */
export interface TransicaoCandidaturaRegistro {
  candidaturaId: string;
  esperado: { status: StatusCandidatura; atualizadoEm: Date };
  proximo: { status: StatusCandidatura; statusAntesDaEspera: StatusCandidatura | null; atualizadoEm: Date };
  historico: HistoricoStatusRegistro;
}
