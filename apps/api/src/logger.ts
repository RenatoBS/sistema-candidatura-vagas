import { envOu } from '@scv/env';
import { stdSerializers, type LoggerOptions } from 'pino';

/** Caminhos mascarados em todo log de requisição/resposta (headers com segredo). */
export const CAMINHOS_REDACT = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-internal-token"]',
  'req.headers["x-reauth-token"]',
  'req.headers["x-webhook-secret"]',
  'req.headers.token',
  'res.headers["set-cookie"]',
];

const PARAMETROS_SECRETOS = /([?&](?:segredo|token|secret)=)[^&#]*/gi;

/** Esconde segredos que viajam na query (ex.: webhook da Uazapi) antes de a URL ir para o log. */
export function redigirUrl(url: string | undefined): string | undefined {
  return url?.replace(PARAMETROS_SECRETOS, '$1[Redacted]');
}

export function opcoesLogger(env: NodeJS.ProcessEnv = process.env): LoggerOptions {
  return {
    level: envOu(env, 'LOG_LEVEL', 'info'),
    redact: CAMINHOS_REDACT,
    serializers: {
      req(req: Parameters<typeof stdSerializers.req>[0]) {
        const serializada = stdSerializers.req(req);
        return { ...serializada, url: redigirUrl(serializada.url) };
      },
    },
  };
}
