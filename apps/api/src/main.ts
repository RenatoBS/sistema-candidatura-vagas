import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Logger as PinoLogger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { initTelemetry } from './telemetry';

async function bootstrap() {
  initTelemetry();

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(PinoLogger));
  app.setGlobalPrefix('api/v1');

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port);

  Logger.log(`API escutando em http://localhost:${port}/api/v1/health`, 'Bootstrap');
}

bootstrap();
