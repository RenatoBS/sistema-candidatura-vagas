import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FilaVagasBull, type FilaPrazos } from '../src/fila/fila-vagas';

interface JobFalso {
  id: string;
  ativo: boolean;
  removido: boolean;
  isActive(): Promise<boolean>;
  remove(): Promise<void>;
}

/** Fila no estilo do BullMQ: remover job ativo (travado) lança erro; jobId repetido é ignorado. */
function filaFalsa() {
  const jobs = new Map<string, JobFalso>();
  const fila = {
    async getJob(id: string) {
      return jobs.get(id);
    },
    async add(_nome: string, _dados: unknown, opcoes?: { jobId?: string }) {
      const id = opcoes?.jobId ?? `auto-${jobs.size}`;
      if (jobs.has(id)) return jobs.get(id);
      const job: JobFalso = {
        id,
        ativo: false,
        removido: false,
        async isActive() {
          return this.ativo;
        },
        async remove() {
          if (this.ativo) throw new Error(`Job ${id} is locked`);
          this.removido = true;
          jobs.delete(id);
        },
      };
      jobs.set(id, job);
      return job;
    },
  } as unknown as FilaPrazos;
  return { fila, jobs };
}

describe('FC-12 — agendamento de encerramento de vaga', () => {
  it('cancelar durante a execução do próprio job não lança (job termina completed)', async () => {
    const { fila, jobs } = filaFalsa();
    const bull = new FilaVagasBull('h', 0, fila);
    await bull.agendarEncerramento('v1', new Date(Date.now() + 1000));
    jobs.get('encerrar-v1')!.ativo = true; // worker executando: a API chama cancelar ao expirar a vaga
    await assert.doesNotReject(() => bull.cancelarEncerramento('v1'));
    assert.equal(jobs.get('encerrar-v1')?.removido, false);
  });

  it('reagendar com job ativo usa o slot "proximo" e cancelar limpa os dois', async () => {
    const { fila, jobs } = filaFalsa();
    const bull = new FilaVagasBull('h', 0, fila);
    await bull.agendarEncerramento('v1', new Date(Date.now() + 1000));
    jobs.get('encerrar-v1')!.ativo = true;
    await bull.agendarEncerramento('v1', new Date(Date.now() + 5000));
    assert.deepEqual([...jobs.keys()].sort(), ['encerrar-v1', 'encerrar-v1-proximo']);
    await bull.cancelarEncerramento('v1');
    assert.deepEqual([...jobs.keys()], ['encerrar-v1']);
  });

  it('sem job ativo, reagendar substitui o job pendente e cancelar o remove', async () => {
    const { fila, jobs } = filaFalsa();
    const bull = new FilaVagasBull('h', 0, fila);
    await bull.agendarEncerramento('v1', new Date(Date.now() + 1000));
    const primeiro = jobs.get('encerrar-v1');
    await bull.agendarEncerramento('v1', new Date(Date.now() + 2000));
    assert.equal(primeiro?.removido, true);
    assert.equal(jobs.size, 1);
    await bull.cancelarEncerramento('v1');
    assert.equal(jobs.size, 0);
  });
});
