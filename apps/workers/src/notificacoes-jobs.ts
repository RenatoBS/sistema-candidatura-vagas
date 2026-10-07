import { postInterno } from './vagas-jobs';

export const FILA_NOTIFICACOES = 'notificacoes';
export const EVENTO_MATCH_FORTE = 'match.forte';
export const EVENTO_LIMPAR_DISPOSITIVOS = 'limpar-dispositivos';
/** Limpeza diária de tokens de push inativos (retenção em PUSH_TOKEN_RETENCAO_DIAS, lida pela API). */
export const INTERVALO_LIMPEZA_PUSH_MS = 24 * 60 * 60 * 1000;

/** A API aplica preferências/limiar, dedup por chaveDedup e grava `SugestaoMatch.notificadoEm`. */
export function processarNotificacao(
  job: { name: string; data: { sugestaoId?: string } },
  fetchImpl: typeof fetch = fetch,
  env: NodeJS.ProcessEnv = process.env,
): Promise<unknown> {
  if (job.name === EVENTO_MATCH_FORTE && job.data.sugestaoId) {
    return postInterno(`/interno/notificacoes/match-forte/${job.data.sugestaoId}`, fetchImpl, env);
  }
  if (job.name === EVENTO_LIMPAR_DISPOSITIVOS) {
    return postInterno('/interno/dispositivos-push/limpeza', fetchImpl, env);
  }
  return Promise.reject(new Error(`job de notificação inválido: ${job.name}`));
}
