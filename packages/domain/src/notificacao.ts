import type { StatusVaga } from './vaga';

/** Tipos que a empresa recebe na F6-06. */
export type TipoNotificacaoEmpresa =
  | 'CANDIDATO_NOVO'
  | 'MATCH_FORTE'
  | 'WHATSAPP_DESCONECTADO'
  | 'OPERACIONAL';

/** Janela de agrupamento de CANDIDATO_NOVO por vaga. */
export const JANELA_AGRUPAMENTO_MINUTOS_PADRAO = 60;
/** A partir de N candidaturas na mesma janela a notificação vira um resumo ("N candidatos novos"). */
export const MINIMO_RESUMO_PADRAO = 3;

export interface PreferenciaCanais {
  inApp: boolean;
  push: boolean;
  email: boolean;
  /** Só MATCH_FORTE. `null` usa o limiar da plataforma. */
  limiarMatch: number | null;
}

export const PREFERENCIA_PADRAO: Readonly<PreferenciaCanais> = Object.freeze({
  inApp: true,
  push: true,
  email: false,
  limiarMatch: null,
});

export interface CanaisNotificacao {
  inApp: boolean;
  push: boolean;
  email: boolean;
}

/** Vaga pausada, fechada ou em rascunho não gera nada para a empresa. */
export function vagaNotificavel(status: StatusVaga): boolean {
  return status === 'PUBLICADA' || status === 'INSCRICOES_ENCERRADAS';
}

/** Início da janela fixa que contém `agora` (janelas alinhadas à época, em UTC). */
export function inicioJanela(agora: Date, janelaMinutos: number = JANELA_AGRUPAMENTO_MINUTOS_PADRAO): Date {
  const tamanho = Math.max(1, Math.floor(janelaMinutos)) * 60_000;
  return new Date(Math.floor(agora.getTime() / tamanho) * tamanho);
}

export type EntradaChaveDedup =
  | { tipo: 'MATCH_FORTE'; usuarioId: string; vagaId: string; candidatoId: string }
  | { tipo: 'CANDIDATO_NOVO'; usuarioId: string; vagaId: string; agora: Date; janelaMinutos?: number };

/**
 * `chaveDedup` é única na tabela inteira e cada destinatário tem a sua linha,
 * por isso a chave sempre termina no usuário.
 * MATCH_FORTE: vaga+candidato (uma por par, para sempre). CANDIDATO_NOVO: vaga+janela.
 */
export function chaveDedup(entrada: EntradaChaveDedup): string {
  if (entrada.tipo === 'MATCH_FORTE') {
    return `MATCH_FORTE:${entrada.vagaId}:${entrada.candidatoId}:${entrada.usuarioId}`;
  }
  const janela = inicioJanela(entrada.agora, entrada.janelaMinutos).toISOString();
  return `CANDIDATO_NOVO:${entrada.vagaId}:${janela}:${entrada.usuarioId}`;
}

/**
 * Canais efetivos para um destinatário. MATCH_FORTE abaixo do limiar pessoal
 * desliga tudo; o limiar pessoal só pode subir o da plataforma (o evento já
 * nasce filtrado pelo limiar global).
 */
export function canaisEfetivos(
  tipo: TipoNotificacaoEmpresa,
  preferencia: PreferenciaCanais | null,
  contexto: { compatibilidade?: number; limiarPlataforma: number },
): CanaisNotificacao {
  const pref = preferencia ?? PREFERENCIA_PADRAO;
  const nenhum = { inApp: false, push: false, email: false };
  if (tipo === 'MATCH_FORTE') {
    const limiar = Math.max(contexto.limiarPlataforma, pref.limiarMatch ?? 0);
    if (contexto.compatibilidade === undefined || contexto.compatibilidade < limiar) return nenhum;
  }
  return { inApp: pref.inApp, push: pref.push, email: pref.email };
}

export function algumCanal(canais: CanaisNotificacao): boolean {
  return canais.inApp || canais.push || canais.email;
}

/** MATCH_FORTE nunca agrupa: chave repetida é descartada (dedup). */
export function agrupavel(tipo: TipoNotificacaoEmpresa): boolean {
  return tipo === 'CANDIDATO_NOVO';
}

export interface DecisaoAgrupamento {
  /** A notificação passa a ser um resumo ("N candidatos novos"), sem dados de um candidato só. */
  resumo: boolean;
  /** Push/e-mail saem só na criação e quando vira resumo: no máximo 2 por janela. */
  entregarFora: boolean;
}

/**
 * Anti-spam, avaliado sobre `agrupadas` já gravado pelo upsert atômico
 * (candidaturas concorrentes na mesma janela caem na mesma linha).
 * 10 candidaturas seguidas = 1 notificação com `agrupadas = 10`.
 */
export function decidirAgrupamento(
  tipo: TipoNotificacaoEmpresa,
  agrupadas: number,
  minimoResumo: number = MINIMO_RESUMO_PADRAO,
): DecisaoAgrupamento {
  const resumo = agrupavel(tipo) && agrupadas >= minimoResumo;
  return { resumo, entregarFora: agrupadas === 1 || (resumo && agrupadas === minimoResumo) };
}

export function limiarPreferenciaValido(valor: number | null): boolean {
  return valor === null || (Number.isFinite(valor) && valor > 0 && valor <= 1);
}
