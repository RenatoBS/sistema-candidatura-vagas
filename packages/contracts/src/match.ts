/** Respostas das rotas de match (F6-04). */

export type StatusSugestaoMatch = 'PENDENTE' | 'NOTIFICADA' | 'CONVIDADA' | 'ACEITA' | 'RECUSADA' | 'EXPIRADA';

export interface ExplicacaoMatchDto {
  versao: string;
  similaridade: number;
  coberturaHabilidades: number | null;
  atendidas: string[];
  abaixoDoNivel: string[];
  faltantes: string[];
}

/** Visão da empresa: até o aceite do convite, só um resumo do candidato. */
export interface SugestaoMatchDto {
  id: string;
  candidatoId: string;
  compatibilidade: number;
  forte: boolean;
  explicacao: ExplicacaoMatchDto;
  status: StatusSugestaoMatch;
  criadoEm: string;
  atualizadoEm: string;
  candidato: { primeiroNome: string; habilidades: Array<{ nome: string; nivel: number }> };
}

export interface SugestoesMatchVagaResponse {
  vagaId: string;
  statusVaga: string;
  aceitaInscricoes: boolean;
  limiarForte: number;
  sugestoes: SugestaoMatchDto[];
}

/** Visão do candidato: sem compatibilidade, score ou posição. */
export interface VagaRecomendadaDto {
  id: string;
  titulo: string;
  senioridade: string;
  modelo: string;
  localidade: string | null;
  prazoInscricoes: string | null;
  prazoInscricoesBrasilia: string | null;
  habilidadesEmComum: string[];
}

export interface VagasRecomendadasResponse {
  visivelParaMatch: boolean;
  vagas: VagaRecomendadaDto[];
}
