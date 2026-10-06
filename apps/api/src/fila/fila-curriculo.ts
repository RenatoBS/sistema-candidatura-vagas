import { Queue } from 'bullmq';

export interface FilaCurriculo {
  enfileirar(curriculoId: string): Promise<void>;
}

export class FilaCurriculoMemoria implements FilaCurriculo {
  readonly jobs: string[] = [];

  async enfileirar(curriculoId: string): Promise<void> {
    this.jobs.push(curriculoId);
  }

  limpar(): void {
    this.jobs.length = 0;
  }
}

export class FilaCurriculoBull implements FilaCurriculo {
  private fila: Queue | null = null;

  constructor(
    private readonly host = process.env.REDIS_HOST ?? 'localhost',
    private readonly port = Number(process.env.REDIS_PORT ?? 6379),
  ) {}

  async enfileirar(curriculoId: string): Promise<void> {
    if (!this.fila) {
      this.fila = new Queue('cv-processamento', { connection: { host: this.host, port: this.port } });
    }
    try {
      await this.fila.add(
        'cv-processamento',
        { curriculoId },
        { jobId: curriculoId, attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: 100 },
      );
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : '';
      if (!/already|exists/i.test(mensagem)) throw erro;
    }
  }
}
