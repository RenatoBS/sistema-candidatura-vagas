import { postInterno } from './vagas-jobs';

export const FILA_EMBEDDINGS = 'embeddings';
export const FILA_MATCH = 'match';


/** O embedding é gerado na API (EmbeddingProvider) e gravado no pgvector; ao terminar, a API enfileira o match. */
export function processarEmbedding(
  job: { name: string; data: { vagaId?: string; candidatoId?: string } },
  fetchImpl: typeof fetch = fetch,
  env: NodeJS.ProcessEnv = process.env,
): Promise<unknown> {
  if (job.name === 'vaga' && job.data.vagaId) {
    return postInterno(`/interno/match/embeddings/vagas/${job.data.vagaId}`, fetchImpl, env);
  }
  if (job.name === 'candidato' && job.data.candidatoId) {
    return postInterno(`/interno/match/embeddings/candidatos/${job.data.candidatoId}`, fetchImpl, env);
  }
  return Promise.reject(new Error(`job de embedding inválido: ${job.name}`));
}

/** Busca vetorial (HNSW) e upsert de SugestaoMatch; vagas não publicadas são ignoradas pela API. */
export function processarMatch(
  job: { name: string; data: { vagaId?: string; candidatoId?: string } },
  fetchImpl: typeof fetch = fetch,
  env: NodeJS.ProcessEnv = process.env,
): Promise<unknown> {
  if (job.name === 'vaga' && job.data.vagaId) {
    return postInterno(`/interno/match/vagas/${job.data.vagaId}`, fetchImpl, env);
  }
  if (job.name === 'candidato' && job.data.candidatoId) {
    return postInterno(`/interno/match/candidatos/${job.data.candidatoId}`, fetchImpl, env);
  }
  return Promise.reject(new Error(`job de match inválido: ${job.name}`));
}
