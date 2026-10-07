import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { Queue, Worker } from 'bullmq';
import express from 'express';
import pino from 'pino';

import { FILA_EMBEDDINGS, FILA_MATCH, processarEmbedding, processarMatch } from './match-jobs';
import { FILA_NOTIFICACOES, processarNotificacao } from './notificacoes-jobs';
import { FILA_CV, processarJobCurriculo } from './processar-cv';
import { FILA_STT_TRANSCRICAO } from './triagem-audio';
import {
  FILA_TRIAGEM_AVALIACAO,
  FILA_TRIAGEM_RETRY,
  FILA_WHATSAPP_ENTRADA,
  FILA_WHATSAPP_MONITORAMENTO,
  processarAvaliacaoTriagem,
  processarEntradaWhatsapp,
  processarEsgotarTriagem,
  processarMonitoramentoWhatsapp,
  processarRetryTriagem,
} from './triagem-fila';
import { FILA_TRIAGEM_INATIVIDADE, processarJobInatividade } from './triagem-inatividade';
import { processarJobTranscricao } from './triagem-jobs';
import {
  aplicarEventoVaga,
  encerrarInscricoesVaga,
  reconciliarVagas,
  sugerirPerguntasVaga,
} from './vagas-jobs';
import { executarVerificacaoCnpj } from './verificar-cnpj';

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });

const redisConnection = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: Number(process.env.REDIS_PORT ?? 6379),
};

const exampleQueue = new Queue('exemplo', { connection: redisConnection });
const filaCnpj = new Queue('verificar-cnpj', { connection: redisConnection });
const filaCv = new Queue(FILA_CV, { connection: redisConnection });
const filaPrazos = new Queue('vagas-prazos', { connection: redisConnection });
const filaSugestoes = new Queue('ia-perguntas', { connection: redisConnection });
const filaEfeitos = new Queue('vagas-efeitos', { connection: redisConnection });
const filaEmbeddings = new Queue(FILA_EMBEDDINGS, { connection: redisConnection });
const filaMatch = new Queue(FILA_MATCH, { connection: redisConnection });
const filaNotificacoes = new Queue(FILA_NOTIFICACOES, { connection: redisConnection });
const filaStt = new Queue(FILA_STT_TRANSCRICAO, { connection: redisConnection });
const filaTriagemInatividade = new Queue(FILA_TRIAGEM_INATIVIDADE, { connection: redisConnection });
const filaWhatsappEntrada = new Queue(FILA_WHATSAPP_ENTRADA, { connection: redisConnection });
const filaTriagemRetry = new Queue(FILA_TRIAGEM_RETRY, { connection: redisConnection });
const filaTriagemAvaliacao = new Queue(FILA_TRIAGEM_AVALIACAO, { connection: redisConnection });
const filaWhatsappMonitoramento = new Queue(FILA_WHATSAPP_MONITORAMENTO, { connection: redisConnection });

void filaWhatsappMonitoramento.add(
  'varrer',
  {},
  {
    repeat: { every: Number(process.env.WHATSAPP_MONITOR_INTERVALO_MS ?? 300_000) },
    jobId: 'monitor-whatsapp',
  },
);

void filaPrazos.add(
  'reconciliar',
  {},
  { repeat: { every: 15 * 60 * 1000 }, jobId: 'reconciliar-vagas' },
);

const worker = new Worker(
  'exemplo',
  async (job) => {
    logger.info({ jobId: job.id, name: job.name }, 'Processando job de exemplo');
    return { processed: true };
  },
  { connection: redisConnection },
);

worker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Job concluído');
});

worker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Job falhou');
});

const workerCnpj = new Worker(
  'verificar-cnpj',
  async (job: { data: { empresaId: string } }) => executarVerificacaoCnpj(job.data.empresaId),
  { connection: redisConnection },
);

const workerCv = new Worker(
  FILA_CV,
  async (job: { data: { curriculoId: string } }) => {
    logger.info({ curriculoId: job.data.curriculoId }, 'Processando currículo');
    return processarJobCurriculo(job.data.curriculoId);
  },
  { connection: redisConnection },
);

workerCv.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err: err.message }, 'Processamento de currículo falhou');
});

workerCnpj.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Verificação de CNPJ falhou');
});

const workerPrazos = new Worker(
  'vagas-prazos',
  async (job: { name: string; data: { vagaId?: string } }) => {
    if (job.name === 'reconciliar' || !job.data.vagaId) return reconciliarVagas();
    return encerrarInscricoesVaga(job.data.vagaId);
  },
  { connection: redisConnection },
);

const workerSugestoes = new Worker(
  'ia-perguntas',
  async (job: { data: { etapaId: string } }) => sugerirPerguntasVaga(job.data.etapaId),
  { connection: redisConnection },
);

const workerEfeitos = new Worker(
  'vagas-efeitos',
  async (job: { data: { eventoId: string } }) => aplicarEventoVaga(job.data.eventoId),
  { connection: redisConnection },
);

for (const workerFila of [workerPrazos, workerSugestoes, workerEfeitos]) {
  workerFila.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Job de vaga falhou');
  });
}

// Chamadas ao provedor de embeddings: concorrência baixa para respeitar rate limit.
const workerEmbeddings = new Worker(FILA_EMBEDDINGS, async (job) => processarEmbedding(job), {
  connection: redisConnection,
  concurrency: 2,
});

const workerMatch = new Worker(FILA_MATCH, async (job) => processarMatch(job), {
  connection: redisConnection,
  concurrency: 2,
});

for (const workerFila of [workerEmbeddings, workerMatch]) {
  workerFila.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, name: job?.name, err: err.message }, 'Job de match falhou');
  });
}

const workerNotificacoes = new Worker(FILA_NOTIFICACOES, async (job) => processarNotificacao(job), {
  connection: redisConnection,
  concurrency: 4,
});
// Costura para F7-10 (Claude Code): a avaliação IA será enfileirada após a transcrição.
const workerStt = new Worker(
  FILA_STT_TRANSCRICAO,
  async (job: {
    data: { respostaId: string };
    attemptsMade: number;
    opts: { attempts?: number };
  }) => processarJobTranscricao(job),
  {
    connection: redisConnection,
  },
);

const workerTriagemInatividade = new Worker(
  FILA_TRIAGEM_INATIVIDADE,
  async (job: { data: { entrevistaId: string; ultimaInteracaoEm: string } }) =>
    processarJobInatividade(job),
  { connection: redisConnection },
);

const workerWhatsappEntrada = new Worker(
  FILA_WHATSAPP_ENTRADA,
  async (job: { data: { eventoId: string } }) => processarEntradaWhatsapp(job.data.eventoId),
  { connection: redisConnection },
);

const workerTriagemRetry = new Worker(
  FILA_TRIAGEM_RETRY,
  async (job: { name: string; data: { entrevistaId: string; numero?: number } }) => {
    if (job.name === 'esgotar') return processarEsgotarTriagem(job.data.entrevistaId);
    return processarRetryTriagem(job.data.entrevistaId, Number(job.data.numero ?? 1));
  },
  { connection: redisConnection },
);

const workerTriagemAvaliacao = new Worker(
  FILA_TRIAGEM_AVALIACAO,
  async (job: { data: { respostaId: string } }) => processarAvaliacaoTriagem(job.data.respostaId),
  { connection: redisConnection },
);

const workerWhatsappMonitoramento = new Worker(
  FILA_WHATSAPP_MONITORAMENTO,
  async () => processarMonitoramentoWhatsapp(),
  { connection: redisConnection },
);

workerNotificacoes.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, name: job?.name, err: err.message }, 'Job de notificação falhou');
});

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [
    new BullMQAdapter(exampleQueue),
    new BullMQAdapter(filaCnpj),
    new BullMQAdapter(filaCv),
    new BullMQAdapter(filaPrazos),
    new BullMQAdapter(filaSugestoes),
    new BullMQAdapter(filaEfeitos),
    new BullMQAdapter(filaEmbeddings),
    new BullMQAdapter(filaMatch),
    new BullMQAdapter(filaNotificacoes),
    new BullMQAdapter(filaStt),
    new BullMQAdapter(filaTriagemInatividade),
    new BullMQAdapter(filaWhatsappEntrada),
    new BullMQAdapter(filaTriagemRetry),
    new BullMQAdapter(filaTriagemAvaliacao),
    new BullMQAdapter(filaWhatsappMonitoramento),
  ],
  serverAdapter,
});

const app = express();
app.use('/admin/queues', serverAdapter.getRouter());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'workers', timestamp: new Date().toISOString() });
});

const port = Number(process.env.WORKERS_PORT ?? 3001);

app.listen(port, () => {
  logger.info({ port }, 'Workers e Bull Board escutando');
});

process.on('SIGTERM', async () => {
  logger.info('Encerrando workers...');
  await worker.close();
  await workerCnpj.close();
  await workerCv.close();
  await workerPrazos.close();
  await workerSugestoes.close();
  await workerEfeitos.close();
  await workerEmbeddings.close();
  await workerMatch.close();
  await workerNotificacoes.close();
  await workerStt.close();
  await workerTriagemInatividade.close();
  await workerWhatsappEntrada.close();
  await workerTriagemRetry.close();
  await workerTriagemAvaliacao.close();
  await workerWhatsappMonitoramento.close();
  await exampleQueue.close();
  await filaCnpj.close();
  await filaCv.close();
  await filaPrazos.close();
  await filaSugestoes.close();
  await filaEfeitos.close();
  await filaEmbeddings.close();
  await filaMatch.close();
  await filaNotificacoes.close();
  await filaStt.close();
  await filaTriagemInatividade.close();
  await filaWhatsappEntrada.close();
  await filaTriagemRetry.close();
  await filaTriagemAvaliacao.close();
  await filaWhatsappMonitoramento.close();
  process.exit(0);
});
