/**
 * Máquina de estados da candidatura (plano do sistema §10).
 * Não existe reprovação automática: REPROVADA só sai de EM_REVISAO por decisão humana.
 */

export type StatusCandidatura =
  | 'CONVIDADA'
  | 'INSCRITA'
  | 'TRIAGEM_WHATSAPP'
  | 'TRIAGEM_CONCLUIDA'
  | 'TRIAGEM_ABANDONADA'
  | 'SEM_RESPOSTA'
  | 'ENTREVISTA_VOZ'
  | 'ENTREVISTA_CONCLUIDA'
  | 'ENTREVISTA_ABANDONADA'
  | 'EM_REVISAO'
  | 'APROVADA'
  | 'REPROVADA'
  | 'CONTRATADA'
  | 'EM_ESPERA'
  | 'ENCERRADA_VAGA_FECHADA'
  | 'DESISTENCIA'
  | 'CONVITE_EXPIRADO';

export const STATUS_CANDIDATURA: readonly StatusCandidatura[] = [
  'CONVIDADA',
  'INSCRITA',
  'TRIAGEM_WHATSAPP',
  'TRIAGEM_CONCLUIDA',
  'TRIAGEM_ABANDONADA',
  'SEM_RESPOSTA',
  'ENTREVISTA_VOZ',
  'ENTREVISTA_CONCLUIDA',
  'ENTREVISTA_ABANDONADA',
  'EM_REVISAO',
  'APROVADA',
  'REPROVADA',
  'CONTRATADA',
  'EM_ESPERA',
  'ENCERRADA_VAGA_FECHADA',
  'DESISTENCIA',
  'CONVITE_EXPIRADO',
];

/**
 * Sem saída. TRIAGEM_ABANDONADA, SEM_RESPOSTA e ENTREVISTA_ABANDONADA não entram aqui:
 * o candidato não avança sozinho, mas a empresa ainda pode mandar para EM_REVISAO.
 */
export const ESTADOS_TERMINAIS_CANDIDATURA: readonly StatusCandidatura[] = [
  'REPROVADA',
  'CONTRATADA',
  'DESISTENCIA',
  'ENCERRADA_VAGA_FECHADA',
  'CONVITE_EXPIRADO',
];

export interface EstadoCandidatura {
  status: StatusCandidatura;
  statusAntesDaEspera: StatusCandidatura | null;
}

/** Comandos que criam a candidatura (estado anterior inexistente). */
export type ComandoCriacaoCandidatura =
  | { tipo: 'candidatarDireta'; vagaAceitaInscricoes: boolean }
  | { tipo: 'convidar'; vagaAceitaInscricoes: boolean };

export type ComandoCandidatura =
  | { tipo: 'aceitarConvite'; vagaAceitaInscricoes: boolean }
  | { tipo: 'recusarConvite' }
  | { tipo: 'expirarConvite' }
  | { tipo: 'iniciarTriagem' }
  | { tipo: 'concluirTriagem' }
  | { tipo: 'abandonarTriagem' }
  | { tipo: 'esgotarRetries' }
  | { tipo: 'iniciarEntrevistaVoz' }
  | { tipo: 'concluirEntrevista' }
  | { tipo: 'abandonarEntrevista' }
  | { tipo: 'concederExcecaoVoz' }
  | { tipo: 'enviarRevisao' }
  | { tipo: 'aprovar'; autorHumanoId: string }
  | { tipo: 'reprovar'; autorHumanoId: string }
  | { tipo: 'contratar'; autorHumanoId: string }
  | { tipo: 'desistir' }
  | { tipo: 'pausarVaga' }
  | { tipo: 'retomarVaga' }
  | { tipo: 'fecharVaga' };

export type TipoComandoCandidatura = ComandoCandidatura['tipo'] | ComandoCriacaoCandidatura['tipo'];

export type ErroTransicaoCandidatura =
  | 'TRANSICAO_INVALIDA'
  | 'CANDIDATURA_ENCERRADA'
  | 'INSCRICOES_INDISPONIVEIS'
  | 'DECISAO_HUMANA_OBRIGATORIA'
  | 'ESTADO_ANTERIOR_AUSENTE';

export type ResultadoTransicaoCandidatura =
  | { ok: true; estado: EstadoCandidatura; de: StatusCandidatura | null }
  | { ok: false; codigo: ErroTransicaoCandidatura };

/** Efeitos de evento de vaga (F4-09) que mexem na candidatura. Os demais são de retry (Fase 7). */
export type ComandoEfeitoVaga = Extract<ComandoCandidatura, { tipo: 'pausarVaga' | 'retomarVaga' | 'fecharVaga' }>;

export const COMANDO_POR_EFEITO_VAGA: Readonly<Record<string, ComandoEfeitoVaga['tipo']>> = {
  EM_ESPERA: 'pausarVaga',
  RETOMAR_STATUS_ANTERIOR: 'retomarVaga',
  ENCERRADA_VAGA_FECHADA: 'fecharVaga',
};

type ComandoSimples = Exclude<
  ComandoCandidatura['tipo'],
  'aceitarConvite' | 'aprovar' | 'reprovar' | 'contratar' | 'desistir' | 'pausarVaga' | 'retomarVaga' | 'fecharVaga'
>;

const TRANSICOES_SIMPLES: Record<ComandoSimples, { de: readonly StatusCandidatura[]; para: StatusCandidatura }> = {
  recusarConvite: { de: ['CONVIDADA'], para: 'CONVITE_EXPIRADO' },
  expirarConvite: { de: ['CONVIDADA'], para: 'CONVITE_EXPIRADO' },
  iniciarTriagem: { de: ['INSCRITA'], para: 'TRIAGEM_WHATSAPP' },
  concluirTriagem: { de: ['TRIAGEM_WHATSAPP'], para: 'TRIAGEM_CONCLUIDA' },
  abandonarTriagem: { de: ['TRIAGEM_WHATSAPP'], para: 'TRIAGEM_ABANDONADA' },
  esgotarRetries: { de: ['TRIAGEM_WHATSAPP'], para: 'SEM_RESPOSTA' },
  iniciarEntrevistaVoz: { de: ['TRIAGEM_CONCLUIDA'], para: 'ENTREVISTA_VOZ' },
  concluirEntrevista: { de: ['ENTREVISTA_VOZ'], para: 'ENTREVISTA_CONCLUIDA' },
  abandonarEntrevista: { de: ['ENTREVISTA_VOZ'], para: 'ENTREVISTA_ABANDONADA' },
  concederExcecaoVoz: { de: ['ENTREVISTA_ABANDONADA'], para: 'TRIAGEM_CONCLUIDA' },
  enviarRevisao: {
    de: ['TRIAGEM_CONCLUIDA', 'TRIAGEM_ABANDONADA', 'SEM_RESPOSTA', 'ENTREVISTA_CONCLUIDA', 'ENTREVISTA_ABANDONADA'],
    para: 'EM_REVISAO',
  },
};

const DECISOES_HUMANAS = {
  aprovar: { de: 'EM_REVISAO', para: 'APROVADA' },
  reprovar: { de: 'EM_REVISAO', para: 'REPROVADA' },
  contratar: { de: 'APROVADA', para: 'CONTRATADA' },
} as const satisfies Record<string, { de: StatusCandidatura; para: StatusCandidatura }>;

const ROTULOS: Record<StatusCandidatura, string> = {
  CONVIDADA: 'Convite recebido',
  INSCRITA: 'Inscrição recebida',
  TRIAGEM_WHATSAPP: 'Triagem pelo WhatsApp',
  TRIAGEM_CONCLUIDA: 'Em análise pela empresa',
  TRIAGEM_ABANDONADA: 'Triagem não concluída',
  SEM_RESPOSTA: 'Triagem sem resposta',
  ENTREVISTA_VOZ: 'Entrevista por voz',
  ENTREVISTA_CONCLUIDA: 'Em análise pela empresa',
  ENTREVISTA_ABANDONADA: 'Entrevista não concluída',
  EM_REVISAO: 'Em análise pela empresa',
  APROVADA: 'Candidatura aprovada',
  REPROVADA: 'Candidatura não selecionada',
  CONTRATADA: 'Contratação confirmada',
  EM_ESPERA: 'Processo pausado pela empresa',
  ENCERRADA_VAGA_FECHADA: 'Vaga encerrada pela empresa',
  DESISTENCIA: 'Desistência registrada',
  CONVITE_EXPIRADO: 'Convite encerrado',
};

export function candidaturaTerminal(status: StatusCandidatura): boolean {
  return ESTADOS_TERMINAIS_CANDIDATURA.includes(status);
}

/** Rótulo pt-BR exibido ao candidato. Nunca carrega score, posição ou total de candidatos. */
export function rotuloAmigavel(status: StatusCandidatura): string {
  return ROTULOS[status];
}

export function criarCandidatura(comando: ComandoCriacaoCandidatura): ResultadoTransicaoCandidatura {
  if (!comando.vagaAceitaInscricoes) return { ok: false, codigo: 'INSCRICOES_INDISPONIVEIS' };
  const status: StatusCandidatura = comando.tipo === 'convidar' ? 'CONVIDADA' : 'INSCRITA';
  return { ok: true, de: null, estado: { status, statusAntesDaEspera: null } };
}

export function transicionarCandidatura(
  estado: EstadoCandidatura,
  comando: ComandoCandidatura,
): ResultadoTransicaoCandidatura {
  if (candidaturaTerminal(estado.status)) return { ok: false, codigo: 'CANDIDATURA_ENCERRADA' };
  if (comando.tipo === 'aceitarConvite') return aceitarConvite(estado, comando.vagaAceitaInscricoes);
  if (comando.tipo === 'aprovar' || comando.tipo === 'reprovar' || comando.tipo === 'contratar') {
    return decidir(estado, comando.tipo, comando.autorHumanoId);
  }
  if (comando.tipo === 'desistir') return desistir(estado);
  if (comando.tipo === 'pausarVaga') return pausarVaga(estado);
  if (comando.tipo === 'retomarVaga') return retomarVaga(estado);
  if (comando.tipo === 'fecharVaga') return mover(estado, 'ENCERRADA_VAGA_FECHADA');
  const regra = TRANSICOES_SIMPLES[comando.tipo];
  if (!regra.de.includes(estado.status)) return { ok: false, codigo: 'TRANSICAO_INVALIDA' };
  return mover(estado, regra.para);
}

function mover(estado: EstadoCandidatura, para: StatusCandidatura): ResultadoTransicaoCandidatura {
  return { ok: true, de: estado.status, estado: { status: para, statusAntesDaEspera: null } };
}

function aceitarConvite(estado: EstadoCandidatura, vagaAceitaInscricoes: boolean): ResultadoTransicaoCandidatura {
  if (estado.status !== 'CONVIDADA') return { ok: false, codigo: 'TRANSICAO_INVALIDA' };
  if (!vagaAceitaInscricoes) return { ok: false, codigo: 'INSCRICOES_INDISPONIVEIS' };
  return mover(estado, 'INSCRITA');
}

function decidir(
  estado: EstadoCandidatura,
  tipo: keyof typeof DECISOES_HUMANAS,
  autorHumanoId: string,
): ResultadoTransicaoCandidatura {
  if (!autorHumanoId.trim()) return { ok: false, codigo: 'DECISAO_HUMANA_OBRIGATORIA' };
  const regra = DECISOES_HUMANAS[tipo];
  if (estado.status !== regra.de) return { ok: false, codigo: 'TRANSICAO_INVALIDA' };
  return mover(estado, regra.para);
}

function desistir(estado: EstadoCandidatura): ResultadoTransicaoCandidatura {
  // Convite pendente se recusa; desistência pressupõe inscrição.
  if (estado.status === 'CONVIDADA') return { ok: false, codigo: 'TRANSICAO_INVALIDA' };
  return mover(estado, 'DESISTENCIA');
}

function pausarVaga(estado: EstadoCandidatura): ResultadoTransicaoCandidatura {
  if (estado.status === 'EM_ESPERA') return { ok: false, codigo: 'TRANSICAO_INVALIDA' };
  return { ok: true, de: estado.status, estado: { status: 'EM_ESPERA', statusAntesDaEspera: estado.status } };
}

function retomarVaga(estado: EstadoCandidatura): ResultadoTransicaoCandidatura {
  if (estado.status !== 'EM_ESPERA') return { ok: false, codigo: 'TRANSICAO_INVALIDA' };
  const anterior = estado.statusAntesDaEspera;
  if (!anterior || anterior === 'EM_ESPERA' || candidaturaTerminal(anterior)) {
    return { ok: false, codigo: 'ESTADO_ANTERIOR_AUSENTE' };
  }
  return mover(estado, anterior);
}
