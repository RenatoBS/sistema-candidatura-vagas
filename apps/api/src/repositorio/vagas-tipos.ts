import type { PoliticaRetry, StatusVaga } from '@scv/domain';

export type SenioridadeVaga = 'ESTAGIO' | 'JUNIOR' | 'PLENO' | 'SENIOR' | 'ESPECIALISTA' | 'LIDERANCA';
export type ModeloTrabalho = 'REMOTO' | 'HIBRIDO' | 'PRESENCIAL';
export type TipoContrato = 'CLT' | 'PJ' | 'TEMPORARIO' | 'ESTAGIO' | 'AUTONOMO';
export type TipoEtapa = 'TRIAGEM_WHATSAPP' | 'ENTREVISTA_VOZ' | 'REVISAO_HUMANA';
export type OrigemPergunta = 'EMPRESA' | 'IA_SUGERIDA' | 'CATALOGO';
export type StatusSugestao = 'NAO_APLICA' | 'PENDENTE' | 'APROVADA' | 'DESCARTADA';

export interface HabilidadeCatalogo {
  id: string;
  nome: string;
  categoria: string;
}

export interface VagaRegistro {
  id: string;
  empresaId: string;
  titulo: string;
  descricao: string;
  senioridade: SenioridadeVaga;
  modelo: ModeloTrabalho;
  localidade: string | null;
  tipoContrato: TipoContrato | null;
  faixaSalarialMin: number | null;
  faixaSalarialMax: number | null;
  beneficios: string[];
  posicoes: number;
  status: StatusVaga;
  prazoInscricoes: Date | null;
  inscricoesEncerradasEm: Date | null;
  pausadaEm: Date | null;
  statusAntesDaPausa: StatusVaga | null;
  fechadaEm: Date | null;
  motivoFechamento: string | null;
  alertaPausaEm: Date | null;
  criadoEm: Date;
  atualizadoEm: Date;
}

export interface VagaHabilidadeRegistro {
  vagaId: string;
  habilidadeId: string;
  nome: string;
  nivelMinimo: number;
  peso: number;
  obrigatoria: boolean;
}

export interface ProcessoRegistro {
  id: string;
  vagaId: string;
  empresaId: string;
  tempoPadraoPorPergunta: number;
  politicaRetry: PoliticaRetry;
  janelaReconexaoSegundos: number;
}

export interface EtapaRegistro {
  id: string;
  processoId: string;
  ordem: number;
  tipo: TipoEtapa;
  numeroPerguntas: number;
}

export interface PerguntaRegistro {
  id: string;
  empresaId: string;
  enunciado: string;
  rubrica: Record<string, unknown>;
  origem: OrigemPergunta;
  statusSugestao: StatusSugestao;
  versaoPrompt: string | null;
  etapaAlvoId: string | null;
  tempoLimiteSegundos: number | null;
}

export interface EtapaPerguntaRegistro {
  id: string;
  etapaId: string;
  perguntaId: string;
  ordem: number;
  peso: number;
  tempoLimiteSegundos: number | null;
}

export interface EventoVagaRegistro {
  id: string;
  empresaId: string;
  vagaId: string;
  tipo: string;
  payload: Record<string, unknown>;
  criadoEm: Date;
  consumidoEm: Date | null;
}

export interface FiltroVagaPublica {
  habilidade?: string;
  senioridade?: string;
  modelo?: string;
  localidade?: string;
  agora: Date;
}
