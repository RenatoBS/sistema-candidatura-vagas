/**
 * Regras puras da entrevista por voz (Fase 8).
 * Q3, Q9, Q10 e Q20 estão provisórios no ADR 0007.
 */

export const JANELA_RECONEXAO_MS_PADRAO = 60_000;
export const AVISO_EXPIRACAO_SEGUNDOS = 15;
export const VOZ_MAX_SESSOES_SIMULTANEAS = 50;
const LIMIAR_FOLLOWUP_CARACTERES = 40;

const ATRIBUTO_PROTEGIDO =
  /\b(idade|gênero|genero|religião|religiao|raça|raca|etnia|estado civil|orientação|orientacao)\b/i;

export interface EstadoVoz {
  indice: number;
  inicioPerguntaEm: string;
  pausadoMs: number;
  pausadoEm: string | null;
  followUpUsado: boolean;
  avisoEnviado: boolean;
  rascunho: string | null;
}

export interface PerguntaRoteiro {
  ordem: number;
  enunciado: string;
  tempoLimiteSegundos: number;
}

export function tempoRestanteSegundos(estado: EstadoVoz, agora: Date, limiteSegundos: number): number {
  const inicio = new Date(estado.inicioPerguntaEm).getTime();
  const fim = estado.pausadoEm ? new Date(estado.pausadoEm).getTime() : agora.getTime();
  const decorrido = Math.max(0, fim - inicio - estado.pausadoMs);
  return limiteSegundos - Math.floor(decorrido / 1000);
}

export function avaliarAviso(restanteSegundos: number): 'ok' | 'avisar' | 'expirar' {
  if (restanteSegundos <= 0) return 'expirar';
  if (restanteSegundos <= AVISO_EXPIRACAO_SEGUNDOS) return 'avisar';
  return 'ok';
}

export type DecisaoTurno =
  | { acao: 'expirar'; indice: number; tempoUsado: number }
  | { acao: 'followup'; enunciado: string; estado: EstadoVoz }
  | {
      acao: 'avancar';
      indice: number;
      tempoUsado: number;
      texto: string;
      proxima: PerguntaRoteiro | null;
      estado: EstadoVoz;
    };

export function decidirTurno(entrada: {
  perguntas: PerguntaRoteiro[];
  estado: EstadoVoz;
  agora: Date;
  texto: string;
}): DecisaoTurno {
  const perguntas = [...entrada.perguntas].sort((a, b) => a.ordem - b.ordem);
  const atual = perguntas[entrada.estado.indice];
  if (!atual) {
    return {
      acao: 'avancar',
      indice: entrada.estado.indice,
      tempoUsado: 0,
      texto: entrada.texto,
      proxima: null,
      estado: entrada.estado,
    };
  }
  const restante = tempoRestanteSegundos(entrada.estado, entrada.agora, atual.tempoLimiteSegundos);
  const tempoUsado = atual.tempoLimiteSegundos - Math.max(restante, 0);
  if (restante <= 0) return { acao: 'expirar', indice: entrada.estado.indice, tempoUsado: atual.tempoLimiteSegundos };
  const texto = [entrada.estado.rascunho, entrada.texto.trim()].filter(Boolean).join(' ');
  const protegido = ATRIBUTO_PROTEGIDO.test(entrada.texto);
  if (
    !protegido &&
    !entrada.estado.followUpUsado &&
    restante > AVISO_EXPIRACAO_SEGUNDOS &&
    entrada.texto.trim().length < LIMIAR_FOLLOWUP_CARACTERES
  ) {
    return {
      acao: 'followup',
      enunciado: 'Pode detalhar o ponto principal, dentro do tempo desta pergunta?',
      estado: { ...entrada.estado, followUpUsado: true, rascunho: texto },
    };
  }
  const proxima = perguntas[entrada.estado.indice + 1] ?? null;
  return {
    acao: 'avancar',
    indice: entrada.estado.indice,
    tempoUsado,
    texto,
    proxima,
    estado: proxima
      ? {
          indice: entrada.estado.indice + 1,
          inicioPerguntaEm: entrada.agora.toISOString(),
          pausadoMs: 0,
          pausadoEm: null,
          followUpUsado: false,
          avisoEnviado: false,
          rascunho: null,
        }
      : { ...entrada.estado, indice: entrada.estado.indice + 1, rascunho: null },
  };
}

export function avaliarReconexao(
  desconectadoEm: Date,
  agora: Date,
  janelaMs = JANELA_RECONEXAO_MS_PADRAO,
): 'mesma_sessao' | 'abandonar' {
  return agora.getTime() - desconectadoEm.getTime() <= janelaMs ? 'mesma_sessao' : 'abandonar';
}

export function pausarTimer(estado: EstadoVoz, agora: Date): EstadoVoz {
  if (estado.pausadoEm) return estado;
  return { ...estado, pausadoEm: agora.toISOString() };
}

export function retomarTimer(estado: EstadoVoz, agora: Date): EstadoVoz {
  if (!estado.pausadoEm) return estado;
  const pausa = Math.max(0, agora.getTime() - new Date(estado.pausadoEm).getTime());
  return { ...estado, pausadoEm: null, pausadoMs: estado.pausadoMs + pausa };
}

export function concederExcecao(jaConcedida: boolean): { ok: true } | { ok: false; codigo: 'EXCECAO_JA_CONCEDIDA' } {
  if (jaConcedida) return { ok: false, codigo: 'EXCECAO_JA_CONCEDIDA' };
  return { ok: true };
}

export function decidirAdmissao(ativas: number, max = VOZ_MAX_SESSOES_SIMULTANEAS): 'admitir' | 'fila' {
  return ativas >= max ? 'fila' : 'admitir';
}

export function percentil50(valores: number[]): number {
  if (valores.length === 0) return 0;
  const ordenados = [...valores].sort((a, b) => a - b);
  return ordenados[Math.floor((ordenados.length - 1) / 2)] ?? 0;
}
