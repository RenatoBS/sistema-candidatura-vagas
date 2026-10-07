import { envNumero, envOu } from '@scv/env';
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

/** Parte de `Queue` usada para os prazos (permite fila falsa nos testes). */
export type FilaPrazos = Pick<Queue, 'getJob' | 'add'>;

export class FilaVagasBull implements FilaVagas {
  private prazos: FilaPrazos | null = null;
  private sugestoes: Queue | null = null;
  private efeitos: Queue | null = null;

  constructor(
    private readonly host = envOu(process.env, 'REDIS_HOST', 'localhost'),
    private readonly port = envNumero(process.env, 'REDIS_PORT', 6379),
    prazos?: FilaPrazos,
  ) {
    this.prazos = prazos ?? null;
  }

  /**
   * O job em execução nunca é removido (o BullMQ recusa remover job travado e o próprio encerramento
   * falhava ao cancelar o agendamento). Se já há um job ativo para a vaga, o novo prazo entra no
   * slot `proximo`, que o `cancelar` também limpa.
   */
  async agendarEncerramento(vagaId: string, quando: Date): Promise<void> {
    const fila = this.filaPrazos();
    const principal = `encerrar-${vagaId}`;
    const atraso = Math.max(0, quando.getTime() - Date.now());
    await this.removerSeNaoAtivo(principal);
    const ativo = await fila.getJob(principal);
    const jobId = ativo ? `${principal}-proximo` : principal;
    if (ativo) await this.removerSeNaoAtivo(jobId);
    await fila.add('encerrar', { vagaId }, { jobId, delay: atraso, removeOnComplete: 100 });
  }

  async cancelarEncerramento(vagaId: string): Promise<void> {
    await this.removerSeNaoAtivo(`encerrar-${vagaId}`);
    await this.removerSeNaoAtivo(`encerrar-${vagaId}-proximo`);
  }

  private async removerSeNaoAtivo(jobId: string): Promise<void> {
    const job = await this.filaPrazos().getJob(jobId);
    if (!job) return;
    if (await job.isActive()) return;
    try {
      await job.remove();
    } catch {
      // Travou entre a checagem e a remoção: está em execução, então não há o que cancelar.
    }
  }

  async enfileirarSugestao(etapaId: string): Promise<void> {
    await this.filaSugestoes().add('sugerir', { etapaId }, { attempts: 3, removeOnComplete: 100 });
  }

  async enfileirarEfeitos(eventoId: string): Promise<void> {
    await this.filaEfeitos().add('aplicar', { eventoId }, { attempts: 5, removeOnComplete: 100 });
  }

  private filaPrazos(): FilaPrazos {
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
