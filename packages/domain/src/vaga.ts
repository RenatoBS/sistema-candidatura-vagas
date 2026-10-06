/**
 * Ciclo de vida da vaga, prazo e tempo de pergunta.
 * Decisões Q11–Q14 estão provisórias no ADR 0004.
 */

export type StatusVaga = 'RASCUNHO' | 'PUBLICADA' | 'PAUSADA' | 'INSCRICOES_ENCERRADAS' | 'FECHADA';

export const FUSO_EXIBICAO_VAGA = 'America/Sao_Paulo';
/** O Brasil não adota horário de verão desde 2019. */
export const OFFSET_BRASILIA = '-03:00';
export const PAUSA_MAX_DIAS_PADRAO = 30;
export const TEMPO_PADRAO_PERGUNTA_SEGUNDOS = 180;
export const NUMERO_PERGUNTAS_PADRAO = 5;

export interface PoliticaRetry {
  tentativas: number;
  intervaloMinutos: number;
  prazoTotalHoras: number;
  horarioComercial: boolean;
  prazoInatividadeHoras: number;
}

export const POLITICA_RETRY_PADRAO: PoliticaRetry = {
  tentativas: 3,
  intervaloMinutos: 240,
  prazoTotalHoras: 72,
  horarioComercial: true,
  prazoInatividadeHoras: 24,
};

export interface EstadoVaga {
  status: StatusVaga;
  prazoInscricoes: Date | null;
  statusAntesDaPausa: StatusVaga | null;
  inscricoesEncerradasEm: Date | null;
  pausadaEm: Date | null;
  fechadaEm: Date | null;
  motivoFechamento: string | null;
  alertaPausaEm: Date | null;
}

export type ComandoVaga =
  | { tipo: 'publicar'; prazo: Date; empresaVerificada: boolean }
  | { tipo: 'prorrogar'; prazo: Date }
  | { tipo: 'pausar' }
  | { tipo: 'retomar' }
  | { tipo: 'fechar'; motivo: string }
  | { tipo: 'expirar' };

export type ErroTransicaoVaga =
  | 'TRANSICAO_INVALIDA'
  | 'PRAZO_OBRIGATORIO'
  | 'PRAZO_NO_PASSADO'
  | 'PRAZO_NAO_POSTERIOR'
  | 'EMPRESA_NAO_VERIFICADA'
  | 'MOTIVO_OBRIGATORIO'
  | 'VAGA_FECHADA';

export type TipoEventoVaga = 'VagaPausada' | 'VagaRetomada' | 'VagaFechada' | 'AlertaPausaLonga';

/** Efeitos consumidos pelas fases 6–8. Esta fase só emite. */
export const EFEITOS_EVENTO_VAGA: Record<TipoEventoVaga, readonly string[]> = {
  VagaPausada: ['EM_ESPERA', 'SUSPENDER_RETRIES'],
  VagaRetomada: ['RETOMAR_STATUS_ANTERIOR', 'REAGENDAR_RETRIES'],
  VagaFechada: ['ENCERRADA_VAGA_FECHADA', 'CANCELAR_RETRIES'],
  AlertaPausaLonga: ['ALERTAR_EMPRESA'],
};

export type ResultadoTransicaoVaga =
  | { ok: true; estado: EstadoVaga; evento: TipoEventoVaga | null }
  | { ok: false; codigo: ErroTransicaoVaga };

export function transicionarVaga(estado: EstadoVaga, comando: ComandoVaga, agora: Date): ResultadoTransicaoVaga {
  if (comando.tipo === 'publicar') return publicar(estado, comando, agora);
  if (comando.tipo === 'prorrogar') return prorrogar(estado, comando.prazo, agora);
  if (comando.tipo === 'pausar') return pausar(estado, agora);
  if (comando.tipo === 'retomar') return retomar(estado, agora);
  if (comando.tipo === 'fechar') return fechar(estado, comando.motivo, agora);
  return expirar(estado, agora);
}

export function aceitaInscricoes(estado: Pick<EstadoVaga, 'status' | 'prazoInscricoes'>, agora: Date): boolean {
  return estado.status === 'PUBLICADA' && estado.prazoInscricoes !== null && estado.prazoInscricoes.getTime() > agora.getTime();
}

export function visivelNaListaPublica(estado: Pick<EstadoVaga, 'status' | 'prazoInscricoes'>, agora: Date): boolean {
  return aceitaInscricoes(estado, agora);
}

export function tempoLimiteEfetivo(tempos: {
  etapaPerguntaSegundos?: number | null;
  perguntaSegundos?: number | null;
  processoSegundos: number;
}): number {
  if (tempos.etapaPerguntaSegundos != null) return tempos.etapaPerguntaSegundos;
  if (tempos.perguntaSegundos != null) return tempos.perguntaSegundos;
  return tempos.processoSegundos;
}

export function processoPublicavel(
  etapas: Array<{ numeroPerguntas: number; aprovadas: number; pendentes: number }>,
): boolean {
  return etapas.length > 0 && etapas.every((etapa) => etapa.pendentes === 0 && etapa.aprovadas === etapa.numeroPerguntas);
}

export function deveAlertarPausaLonga(
  estado: Pick<EstadoVaga, 'status' | 'pausadaEm' | 'alertaPausaEm'>,
  agora: Date,
  maxDias: number,
): boolean {
  if (estado.status !== 'PAUSADA' || !estado.pausadaEm || estado.alertaPausaEm) return false;
  const limite = estado.pausadaEm.getTime() + maxDias * 24 * 60 * 60 * 1000;
  return agora.getTime() >= limite;
}

export function formatarInstanteBrasilia(instante: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO_EXIBICAO_VAGA,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(instante);
}

/** Aceita `YYYY-MM-DDTHH:mm` no horário de Brasília ou um ISO com fuso. */
export function interpretarPrazo(entrada: string): Date | null {
  const texto = entrada.trim();
  const local = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})$/.exec(texto);
  const iso = local ? `${local[1]}:00${OFFSET_BRASILIA}` : texto;
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return null;
  return data;
}

function publicar(
  estado: EstadoVaga,
  comando: Extract<ComandoVaga, { tipo: 'publicar' }>,
  _agora: Date,
): ResultadoTransicaoVaga {
  if (estado.status === 'FECHADA') return { ok: false, codigo: 'VAGA_FECHADA' };
  if (estado.status !== 'RASCUNHO') return { ok: false, codigo: 'TRANSICAO_INVALIDA' };
  if (!comando.empresaVerificada) return { ok: false, codigo: 'EMPRESA_NAO_VERIFICADA' };
  if (Number.isNaN(comando.prazo.getTime())) return { ok: false, codigo: 'PRAZO_OBRIGATORIO' };
  if (comando.prazo.getTime() <= _agora.getTime()) return { ok: false, codigo: 'PRAZO_NO_PASSADO' };
  return {
    ok: true,
    evento: null,
    estado: { ...estado, status: 'PUBLICADA', prazoInscricoes: comando.prazo },
  };
}

function prorrogar(estado: EstadoVaga, prazo: Date, agora: Date): ResultadoTransicaoVaga {
  if (estado.status === 'FECHADA') return { ok: false, codigo: 'VAGA_FECHADA' };
  if (estado.status !== 'PUBLICADA' && estado.status !== 'INSCRICOES_ENCERRADAS') {
    return { ok: false, codigo: 'TRANSICAO_INVALIDA' };
  }
  if (prazo.getTime() <= agora.getTime()) return { ok: false, codigo: 'PRAZO_NO_PASSADO' };
  if (estado.status === 'PUBLICADA' && estado.prazoInscricoes && prazo.getTime() <= estado.prazoInscricoes.getTime()) {
    return { ok: false, codigo: 'PRAZO_NAO_POSTERIOR' };
  }
  return {
    ok: true,
    evento: null,
    estado: {
      ...estado,
      status: 'PUBLICADA',
      prazoInscricoes: prazo,
      inscricoesEncerradasEm: null,
    },
  };
}

function pausar(estado: EstadoVaga, agora: Date): ResultadoTransicaoVaga {
  if (estado.status === 'FECHADA') return { ok: false, codigo: 'VAGA_FECHADA' };
  if (estado.status !== 'PUBLICADA' && estado.status !== 'INSCRICOES_ENCERRADAS') {
    return { ok: false, codigo: 'TRANSICAO_INVALIDA' };
  }
  return {
    ok: true,
    evento: 'VagaPausada',
    estado: {
      ...estado,
      status: 'PAUSADA',
      statusAntesDaPausa: estado.status,
      pausadaEm: agora,
      alertaPausaEm: null,
    },
  };
}

function retomar(estado: EstadoVaga, agora: Date): ResultadoTransicaoVaga {
  if (estado.status !== 'PAUSADA') return { ok: false, codigo: 'TRANSICAO_INVALIDA' };
  const prazoVencido = !estado.prazoInscricoes || estado.prazoInscricoes.getTime() <= agora.getTime();
  const estavaEncerrada = estado.statusAntesDaPausa === 'INSCRICOES_ENCERRADAS' || prazoVencido;
  return {
    ok: true,
    evento: 'VagaRetomada',
    estado: {
      ...estado,
      status: estavaEncerrada ? 'INSCRICOES_ENCERRADAS' : 'PUBLICADA',
      inscricoesEncerradasEm: estavaEncerrada ? (estado.inscricoesEncerradasEm ?? agora) : estado.inscricoesEncerradasEm,
      statusAntesDaPausa: null,
      pausadaEm: null,
      alertaPausaEm: null,
    },
  };
}

function fechar(estado: EstadoVaga, motivo: string, agora: Date): ResultadoTransicaoVaga {
  if (estado.status === 'FECHADA') return { ok: false, codigo: 'VAGA_FECHADA' };
  const texto = motivo.trim();
  if (texto.length < 3) return { ok: false, codigo: 'MOTIVO_OBRIGATORIO' };
  return {
    ok: true,
    evento: 'VagaFechada',
    estado: {
      ...estado,
      status: 'FECHADA',
      fechadaEm: agora,
      motivoFechamento: texto,
      pausadaEm: null,
      statusAntesDaPausa: null,
    },
  };
}

function expirar(estado: EstadoVaga, agora: Date): ResultadoTransicaoVaga {
  if (estado.status !== 'PUBLICADA') return { ok: false, codigo: 'TRANSICAO_INVALIDA' };
  if (!estado.prazoInscricoes || estado.prazoInscricoes.getTime() > agora.getTime()) {
    return { ok: false, codigo: 'TRANSICAO_INVALIDA' };
  }
  return {
    ok: true,
    evento: null,
    estado: { ...estado, status: 'INSCRICOES_ENCERRADAS', inscricoesEncerradasEm: agora },
  };
}
