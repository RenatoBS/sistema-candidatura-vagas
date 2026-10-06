import { criarArmazenamentoS3, criarDepsOcrMock, criarDepsOcrReal, executarJobCurriculo } from '@scv/providers';

export const FILA_CV = 'cv-processamento';

export function processarJobCurriculo(curriculoId: string, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  const base = env.API_PUBLIC_URL ?? 'http://localhost:3000';
  return executarJobCurriculo(curriculoId, {
    baseUrl: `${base}/api/v1`,
    token: env.INTERNAL_JOB_TOKEN ?? '',
    storage: criarArmazenamentoS3(env),
    deps: env.OCR_PROVIDER === 'mock' ? criarDepsOcrMock() : criarDepsOcrReal(),
  });
}
