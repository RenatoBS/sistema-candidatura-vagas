import { Queue } from 'bullmq';
export const FILA_WHATSAPP_ENTRADA = 'whatsapp-entrada';
export interface JobWhatsappEntrada {
  eventoId: string;
  empresaId: string;
  instanciaId: string;
  mensagem: unknown;
}
export interface FilaWhatsappEntrada {
  enfileirar(job: JobWhatsappEntrada, jobId: string): Promise<void>;
}
export class FilaWhatsappEntradaMemoria implements FilaWhatsappEntrada {
  jobs: Array<{ job: JobWhatsappEntrada; jobId: string }> = [];
  async enfileirar(job: JobWhatsappEntrada, jobId: string): Promise<void> {
    if (!this.jobs.some((item) => item.jobId === jobId)) this.jobs.push({ job, jobId });
  }
  limpar(): void {
    this.jobs = [];
  }
}
export class FilaWhatsappEntradaBull implements FilaWhatsappEntrada {
  private readonly fila: Queue;
  constructor(
    host = process.env.REDIS_HOST ?? 'localhost',
    port = Number(process.env.REDIS_PORT ?? 6379),
  ) {
    this.fila = new Queue(FILA_WHATSAPP_ENTRADA, { connection: { host, port } });
  }
  async enfileirar(job: JobWhatsappEntrada, jobId: string): Promise<void> {
    await this.fila.add('entrada', job, { jobId, attempts: 3, removeOnComplete: 100 });
  }
}
