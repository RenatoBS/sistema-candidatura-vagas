import { postInterno } from './vagas-jobs';

export const FILA_TRIAGEM_INATIVIDADE = 'triagem-inatividade';

export interface JobInatividade {
  data: { entrevistaId: string; ultimaInteracaoEm: string };
}

export function agendarInatividade(entrevistaId: string, ultimaInteracaoEm: Date) {
  const iso = ultimaInteracaoEm.toISOString();
  return {
    queue: FILA_TRIAGEM_INATIVIDADE,
    name: 'abandonar',
    data: { entrevistaId, ultimaInteracaoEm: iso },
    options: {
      jobId: `inatividade:${entrevistaId}:${iso}`,
      removeOnComplete: 100,
    },
  };
}

export async function processarJobInatividade(
  job: JobInatividade,
  fetchImpl: typeof fetch = fetch,
  env: NodeJS.ProcessEnv = process.env,
): Promise<unknown> {
  return postInterno(
    `/interno/triagem/entrevistas/${job.data.entrevistaId}/abandonar-inatividade`,
    fetchImpl,
    env,
  );
}
