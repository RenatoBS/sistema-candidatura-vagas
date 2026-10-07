import { Queue } from 'bullmq';

export const FILA_EMBEDDINGS = 'embeddings';
export const FILA_MATCH = 'match';
/** Fila do serviço de notificações (F6-06), que ainda não tem consumidor. */
export const FILA_NOTIFICACOES = 'notificacoes';
export const EVENTO_MATCH_FORTE = 'match.forte';

export interface EventoMatchForte {
  sugestaoId: string;
  vagaId: string;
  empresaId: string;
  candidatoId: string;
  ocorridoEm: string;
}

export interface FilaMatch {
  enfileirarEmbeddingVaga(vagaId: string): Promise<void>;
  enfileirarEmbeddingCandidato(candidatoId: string): Promise<void>;
  enfileirarMatchVaga(vagaId: string): Promise<void>;
  enfileirarMatchCandidato(candidatoId: string): Promise<void>;
  /**
   * Publicado uma única vez por vaga+candidato, quando a sugestão vira NOTIFICADA.
   * F6-06 consome, aplica preferências/limiar da empresa, agrupa e grava `notificadoEm`.
   */
  publicarMatchForte(evento: EventoMatchForte): Promise<void>;
}

export class FilaMatchMemoria implements FilaMatch {
  embeddingsVaga: string[] = [];
  embeddingsCandidato: string[] = [];
  matchVaga: string[] = [];
  matchCandidato: string[] = [];
  matchForte: EventoMatchForte[] = [];

  async enfileirarEmbeddingVaga(vagaId: string): Promise<void> {
    this.embeddingsVaga.push(vagaId);
  }

  async enfileirarEmbeddingCandidato(candidatoId: string): Promise<void> {
    this.embeddingsCandidato.push(candidatoId);
  }

  async enfileirarMatchVaga(vagaId: string): Promise<void> {
    this.matchVaga.push(vagaId);
  }

  async enfileirarMatchCandidato(candidatoId: string): Promise<void> {
    this.matchCandidato.push(candidatoId);
  }

  async publicarMatchForte(evento: EventoMatchForte): Promise<void> {
    this.matchForte.push({ ...evento });
  }

  limpar(): void {
    this.embeddingsVaga = [];
    this.embeddingsCandidato = [];
    this.matchVaga = [];
    this.matchCandidato = [];
    this.matchForte = [];
  }
}

export class FilaMatchBull implements FilaMatch {
  private embeddings: Queue | null = null;
  private match: Queue | null = null;
  private notificacoes: Queue | null = null;

  constructor(
    private readonly host = process.env.REDIS_HOST ?? 'localhost',
    private readonly port = Number(process.env.REDIS_PORT ?? 6379),
  ) {}

  async enfileirarEmbeddingVaga(vagaId: string): Promise<void> {
    await this.filaEmbeddings().add('vaga', { vagaId }, opcoes());
  }

  async enfileirarEmbeddingCandidato(candidatoId: string): Promise<void> {
    await this.filaEmbeddings().add('candidato', { candidatoId }, opcoes());
  }

  async enfileirarMatchVaga(vagaId: string): Promise<void> {
    await this.filaMatch().add('vaga', { vagaId }, opcoes());
  }

  async enfileirarMatchCandidato(candidatoId: string): Promise<void> {
    await this.filaMatch().add('candidato', { candidatoId }, opcoes());
  }

  async publicarMatchForte(evento: EventoMatchForte): Promise<void> {
    await this.filaNotificacoes().add(EVENTO_MATCH_FORTE, evento, {
      ...opcoes(),
      jobId: `match-forte-${evento.vagaId}-${evento.candidatoId}`,
    });
  }

  private filaEmbeddings(): Queue {
    this.embeddings ??= new Queue(FILA_EMBEDDINGS, { connection: { host: this.host, port: this.port } });
    return this.embeddings;
  }

  private filaMatch(): Queue {
    this.match ??= new Queue(FILA_MATCH, { connection: { host: this.host, port: this.port } });
    return this.match;
  }

  private filaNotificacoes(): Queue {
    this.notificacoes ??= new Queue(FILA_NOTIFICACOES, { connection: { host: this.host, port: this.port } });
    return this.notificacoes;
  }
}

function opcoes() {
  return { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: 100 };
}
