import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Logger as PinoLogger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { FiltroErros } from './http/filtro-erros';
import { avaliarPapelDeRuntime } from './repositorio/papel-runtime';
import { RepositorioPrisma } from './repositorio/prisma';
import { initTelemetry } from './telemetry';
import { REPOSITORIO } from './tokens';

async function bootstrap() {
  initTelemetry();

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(PinoLogger));
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new FiltroErros());
  app.enableCors();

  const repositorio = app.get(REPOSITORIO);
  if (repositorio instanceof RepositorioPrisma) {
    const avaliacao = avaliarPapelDeRuntime(await repositorio.papelDaConexao(), process.env.NODE_ENV);
    if (avaliacao.nivel === 'erro') throw new Error(avaliacao.mensagem);
    if (avaliacao.nivel === 'aviso') Logger.warn(avaliacao.mensagem, 'Bootstrap');
    else Logger.log(avaliacao.mensagem, 'Bootstrap');
  }

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port);

  Logger.log(`API escutando em http://localhost:${port}/api/v1/health`, 'Bootstrap');
}

bootstrap();
