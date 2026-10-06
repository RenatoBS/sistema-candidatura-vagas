import { Queue } from 'bullmq';

export const FILA_PRAZOS = 'vagas-prazos';
export const FILA_SUGESTOES = 'ia-perguntas';
export const FILA_EFEITOS = 'vagas-efeitos';

export interface FilaVagas {
  agendarEncerramento(vagaId: string, quando: Date): Promise<void>;
  cancelarEncerramento(vagaId: string): Promise<void>;
  enfileirarSugestao(etapaId: string): Promise<void>;
  enfileirarEfeitos(eventoId: string): Promise<void>;
}

export class FilaVagasMemoria implements FilaVagas {
  encerramentos: Array<{ vagaId: string; quando: string }> = [];
  sugestoes: string[] = [];
  efeitos: string[] = [];

  async agendarEncerramento(vagaId: string, quando: Date): Promise<void> {
    this.encerramentos = this.encerramentos.filter((item) => item.vagaId !== vagaId);
    this.encerramentos.push({ vagaId, quando: quando.toISOString() });
  }

  async cancelarEncerramento(vagaId: string): Promise<void> {
    this.encerramentos = this.encerramentos.filter((item) => item.vagaId !== vagaId);
  }

  async enfileirarSugestao(etapaId: string): Promise<void> {
    this.sugestoes.push(etapaId);
  }

  async enfileirarEfeitos(eventoId: string): Promise<void> {
    this.efeitos.push(eventoId);
  }

  limpar(): void {
    this.encerramentos = [];
    this.sugestoes = [];
    this.efeitos = [];
  }
}

export class FilaVagasBull implements FilaVagas {
  private prazos: Queue | null = null;
  private sugestoes: Queue | null = null;
  private efeitos: Queue | null = null;

  constructor(
    private readonly host = process.env.REDIS_HOST ?? 'localhost',
    private readonly port = Number(process.env.REDIS_PORT ?? 6379),
  ) {}

  async agendarEncerramento(vagaId: string, quando: Date): Promise<void> {
    const fila = this.filaPrazos();
    const jobId = `encerrar-${vagaId}`;
    const existente = await fila.getJob(jobId);
    if (existente) await existente.remove();
    const atraso = Math.max(0, quando.getTime() - Date.now());
    await fila.add('encerrar', { vagaId }, { jobId, delay: atraso, removeOnComplete: 100 });
  }

  async cancelarEncerramento(vagaId: string): Promise<void> {
    const existente = await this.filaPrazos().getJob(`encerrar-${vagaId}`);
    if (existente) await existente.remove();
  }

  async enfileirarSugestao(etapaId: string): Promise<void> {
    await this.filaSugestoes().add('sugerir', { etapaId }, { attempts: 3, removeOnComplete: 100 });
  }

  async enfileirarEfeitos(eventoId: string): Promise<void> {
    await this.filaEfeitos().add('aplicar', { eventoId }, { attempts: 5, removeOnComplete: 100 });
  }

  private filaPrazos(): Queue {
    this.prazos ??= new Queue(FILA_PRAZOS, { connection: { host: this.host, port: this.port } });
    return this.prazos;
  }

  private filaSugestoes(): Queue {
    this.sugestoes ??= new Queue(FILA_SUGESTOES, { connection: { host: this.host, port: this.port } });
    return this.sugestoes;
  }

  private filaEfeitos(): Queue {
    this.efeitos ??= new Queue(FILA_EFEITOS, { connection: { host: this.host, port: this.port } });
    return this.efeitos;
  }
}
