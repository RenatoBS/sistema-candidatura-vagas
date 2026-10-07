import { Queue } from 'bullmq';

export const FILA_TRIAGEM_RETRY = 'triagem-retry';
export const FILA_TRIAGEM_AVALIACAO = 'ia-avaliacao';
export const FILA_WHATSAPP_MONITORAMENTO = 'whatsapp-monitoramento';

export interface JobTriagem {
  fila: string;
  nome: string;
  jobId: string;
  delayMs: number;
  data: Record<string, unknown>;
}

export interface FilaTriagem {
  agendar(job: JobTriagem): Promise<void>;
  cancelar(fila: string, jobId: string): Promise<void>;
}

export class FilaTriagemMemoria implements FilaTriagem {
  jobs: JobTriagem[] = [];

  async agendar(job: JobTriagem): Promise<void> {
    this.jobs = this.jobs.filter((item) => item.jobId !== job.jobId);
    this.jobs.push(job);
  }

  async cancelar(_fila: string, jobId: string): Promise<void> {
    this.jobs = this.jobs.filter((item) => item.jobId !== jobId);
  }

  limpar(): void {
    this.jobs = [];
  }
}

export class FilaTriagemBull implements FilaTriagem {
  private readonly filas = new Map<string, Queue>();

  constructor(
    private readonly host = process.env.REDIS_HOST ?? 'localhost',
    private readonly port = Number(process.env.REDIS_PORT ?? 6379),
  ) {}

  private fila(nome: string): Queue {
    const existente = this.filas.get(nome);
    if (existente) return existente;
    const criada = new Queue(nome, { connection: { host: this.host, port: this.port } });
    this.filas.set(nome, criada);
    return criada;
  }

  async agendar(job: JobTriagem): Promise<void> {
    await this.fila(job.fila).add(job.nome, job.data, {
      jobId: job.jobId,
      delay: Math.max(0, job.delayMs),
      attempts: 3,
      removeOnComplete: 100,
    });
  }

  async cancelar(fila: string, jobId: string): Promise<void> {
    const existente = await this.fila(fila).getJob(jobId);
    await existente?.remove();
  }
}
