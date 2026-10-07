import http from 'k6/http';
import { check } from 'k6';

// Carga local opcional. A CI prova o mesmo critério com o teste em memória
// apps/api/test/fase10.multiprocesso.test.ts (sem Redis, k6 ou LiveKit).
export const options = {
  vus: 8,
  duration: '15s',
};

export default function () {
  const base = __ENV.API_URL || 'http://localhost:3000';
  const saude = http.get(`${base}/api/v1/health`);
  check(saude, { 'health 200': (resposta) => resposta.status === 200 });
}
