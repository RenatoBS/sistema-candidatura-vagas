import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';

import { HealthModule } from './health/health.module';
import { PlataformaModule } from './plataforma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        transport:
          process.env.NODE_ENV === 'development'
            ? { target: 'pino-pretty', options: { colorize: true } }
            : undefined,
        redact: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.headers["x-internal-token"]',
          'req.headers["x-reauth-token"]',
          'req.headers["x-webhook-secret"]',
          'req.headers.token',
          'res.headers["set-cookie"]',
        ],
      },
    }),
    HealthModule,
    PlataformaModule,
  ],
})
export class AppModule {}
