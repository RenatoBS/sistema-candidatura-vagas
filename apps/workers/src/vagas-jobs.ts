import { envOu } from '@scv/env';

export async function postInterno(
  caminho: string,
  fetchImpl: typeof fetch,
  env: NodeJS.ProcessEnv,
  corpo?: unknown,
): Promise<unknown> {
  const base = envOu(env, 'API_PUBLIC_URL', 'http://localhost:3000');
  const resposta = await fetchImpl(`${base}/api/v1${caminho}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-internal-token': envOu(env, 'INTERNAL_JOB_TOKEN', ''),
    },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  if (!resposta.ok) throw new Error(`job de vaga falhou com status ${resposta.status}`);
  return resposta.json();
}

export function encerrarInscricoesVaga(
  vagaId: string,
  fetchImpl: typeof fetch = fetch,
  env: NodeJS.ProcessEnv = process.env,
): Promise<unknown> {
  return postInterno(`/interno/vagas/${vagaId}/encerrar-inscricoes`, fetchImpl, env);
}

export function reconciliarVagas(fetchImpl: typeof fetch = fetch, env: NodeJS.ProcessEnv = process.env): Promise<unknown> {
  return postInterno('/interno/vagas/reconciliar', fetchImpl, env);
}

export function sugerirPerguntasVaga(
  etapaId: string,
  fetchImpl: typeof fetch = fetch,
  env: NodeJS.ProcessEnv = process.env,
): Promise<unknown> {
  return postInterno(`/interno/etapas/${etapaId}/sugerir`, fetchImpl, env);
}

export function aplicarEventoVaga(
  eventoId: string,
  fetchImpl: typeof fetch = fetch,
  env: NodeJS.ProcessEnv = process.env,
): Promise<unknown> {
  return postInterno(`/interno/eventos-vaga/${eventoId}/aplicar`, fetchImpl, env);
}
