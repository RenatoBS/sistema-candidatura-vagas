import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { Queue, Worker } from 'bullmq';
import express from 'express';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });

const redisConnection = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: Number(process.env.REDIS_PORT ?? 6379),
};

const exampleQueue = new Queue('exemplo', { connection: redisConnection });

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

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [new BullMQAdapter(exampleQueue)],
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
  await exampleQueue.close();
  process.exit(0);
});
