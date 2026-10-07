import { envNumero, envOu } from '@scv/env';
import { Queue } from 'bullmq';

export const FILA_LGPD = 'lgpd-exclusao';

export interface FilaLgpd {
  enfileirarExclusao(solicitacaoId: string): Promise<void>;
}

export class FilaLgpdMemoria implements FilaLgpd {
  readonly jobs: string[] = [];

  async enfileirarExclusao(solicitacaoId: string): Promise<void> {
    this.jobs.push(solicitacaoId);
  }

  limpar(): void {
    this.jobs.length = 0;
  }
}

export class FilaLgpdBull implements FilaLgpd {
  private fila: Queue | null = null;

  constructor(
    private readonly host = envOu(process.env, 'REDIS_HOST', 'localhost'),
    private readonly port = envNumero(process.env, 'REDIS_PORT', 6379),
  ) {}

  async enfileirarExclusao(solicitacaoId: string): Promise<void> {
    this.fila ??= new Queue(FILA_LGPD, { connection: { host: this.host, port: this.port } });
    await this.fila.add(
      'apagar-arquivos',
      { solicitacaoId },
      { jobId: `lgpd-${solicitacaoId}`, attempts: 8, backoff: { type: 'exponential', delay: 30_000 }, removeOnComplete: 100 },
    );
  }
}
