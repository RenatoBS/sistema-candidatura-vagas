import { postInterno } from './vagas-jobs';

export const FILA_WHATSAPP_ENTRADA = 'whatsapp-entrada';
export const FILA_TRIAGEM_RETRY = 'triagem-retry';
export const FILA_TRIAGEM_AVALIACAO = 'ia-avaliacao';
export const FILA_WHATSAPP_MONITORAMENTO = 'whatsapp-monitoramento';

export function processarEntradaWhatsapp(
  eventoId: string,
  fetchImpl: typeof fetch = fetch,
  env: NodeJS.ProcessEnv = process.env,
): Promise<unknown> {
  return postInterno(`/interno/triagem/eventos/${eventoId}/processar`, fetchImpl, env);
}

export function processarRetryTriagem(
  entrevistaId: string,
  numero: number,
  fetchImpl: typeof fetch = fetch,
  env: NodeJS.ProcessEnv = process.env,
): Promise<unknown> {
  return postInterno(`/interno/triagem/entrevistas/${entrevistaId}/retry`, fetchImpl, env, { numero });
}

export function processarEsgotarTriagem(
  entrevistaId: string,
  fetchImpl: typeof fetch = fetch,
  env: NodeJS.ProcessEnv = process.env,
): Promise<unknown> {
  return postInterno(`/interno/triagem/entrevistas/${entrevistaId}/esgotar`, fetchImpl, env);
}

export function processarAvaliacaoTriagem(
  respostaId: string,
  fetchImpl: typeof fetch = fetch,
  env: NodeJS.ProcessEnv = process.env,
): Promise<unknown> {
  return postInterno(`/interno/triagem/respostas/${respostaId}/avaliar`, fetchImpl, env);
}

export function processarMonitoramentoWhatsapp(
  fetchImpl: typeof fetch = fetch,
  env: NodeJS.ProcessEnv = process.env,
): Promise<unknown> {
  return postInterno('/interno/triagem/monitorar', fetchImpl, env);
}
