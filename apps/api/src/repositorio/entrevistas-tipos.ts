export type CanalEntrevista = 'WHATSAPP' | 'VOZ_TEMPO_REAL';
export type StatusEntrevista =
  | 'AGENDADA'
  | 'AGUARDANDO_INICIO'
  | 'RETRY_1'
  | 'RETRY_2'
  | 'RETRY_3'
  | 'EM_ANDAMENTO'
  | 'AGUARDANDO_RESPOSTA'
  | 'PROCESSANDO'
  | 'CONCLUIDA'
  | 'ABANDONADA'
  | 'SEM_RESPOSTA'
  | 'RECUSADA'
  | 'CANCELADA'
  | 'SUSPENSA_PAUSA'
  | 'SUSPENSA_INSTANCIA'
  | 'DISPONIVEL'
  | 'ACEITE_REGISTRADO'
  | 'EM_SESSAO'
  | 'RECONECTANDO'
  | 'EXPIRADA';

export interface EntrevistaRegistro {
  id: string;
  empresaId: string;
  candidaturaId: string;
  etapaId: string;
  canal: CanalEntrevista;
  status: StatusEntrevista;
  retryAtual: number;
  perguntaAtual: number;
  iniciadaEm: Date | null;
  ultimaInteracaoEm: Date | null;
  proximoRetryEm: Date | null;
  aceiteTentativaEm: Date | null;
  excecaoConcedida: boolean;
  encerrarAoFim: boolean;
  criadoEm: Date;
  atualizadoEm: Date;
}
