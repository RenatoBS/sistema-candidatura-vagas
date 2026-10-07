import { FILA_STT_TRANSCRICAO } from './triagem-audio';
import { postInterno } from './vagas-jobs';

export function agendarTranscricao(respostaId: string) {
  return {
    queue: FILA_STT_TRANSCRICAO,
    name: 'transcrever',
    data: { respostaId },
    options: {
      jobId: `stt-${respostaId}`,
      attempts: 3,
      backoff: { type: 'exponential' as const, delay: 5000 },
      removeOnComplete: 100,
    },
  };
}

export async function processarJobTranscricao(
  job: { data: { respostaId: string }; attemptsMade: number; opts: { attempts?: number } },
  fetchImpl: typeof fetch = fetch,
  env: NodeJS.ProcessEnv = process.env,
): Promise<unknown> {
  try {
    return await postInterno(
      `/interno/triagem/respostas/${job.data.respostaId}/transcrever`,
      fetchImpl,
      env,
    );
  } catch (erro) {
    if (job.attemptsMade + 1 >= (job.opts.attempts ?? 3))
      await postInterno(`/interno/triagem/respostas/${job.data.respostaId}/falha`, fetchImpl, env);
    throw erro;
  }
}
