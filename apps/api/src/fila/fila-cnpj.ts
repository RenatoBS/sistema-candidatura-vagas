import { Queue } from 'bullmq';

export interface FilaCnpj {
  enfileirar(empresaId: string): Promise<void>;
}

export class FilaCnpjMemoria implements FilaCnpj {
  readonly jobs: string[] = [];

  async enfileirar(empresaId: string): Promise<void> {
    this.jobs.push(empresaId);
  }

  limpar(): void {
    this.jobs.length = 0;
  }
}

export class FilaCnpjBull implements FilaCnpj {
  private fila: Queue | null = null;

  constructor(
    private readonly host = process.env.REDIS_HOST ?? 'localhost',
    private readonly port = Number(process.env.REDIS_PORT ?? 6379),
  ) {}

  async enfileirar(empresaId: string): Promise<void> {
    if (!this.fila) {
      this.fila = new Queue('verificar-cnpj', { connection: { host: this.host, port: this.port } });
    }
    await this.fila.add(
      'verificar-cnpj',
      { empresaId },
      { attempts: 5, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: 100 },
    );
  }
}
