import { postInterno } from './vagas-jobs';

export const FILA_LGPD = 'lgpd-exclusao';

/**
 * Apaga do storage os arquivos da exclusão LGPD. A API é idempotente; `concluida: false` (algum arquivo
 * falhou) vira erro para o BullMQ repetir com backoff, só com o que ficou pendente.
 */
export async function processarExclusaoLgpd(
  solicitacaoId: string,
  fetchImpl: typeof fetch = fetch,
  env: NodeJS.ProcessEnv = process.env,
): Promise<unknown> {
  const resposta = (await postInterno(`/interno/lgpd/exclusoes/${solicitacaoId}/processar`, fetchImpl, env)) as {
    concluida?: boolean;
    pendentes?: number;
  };
  if (resposta.concluida !== true) {
    throw new Error(`exclusão LGPD incompleta: ${resposta.pendentes ?? '?'} arquivo(s) pendente(s)`);
  }
  return resposta;
}
