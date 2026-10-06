import { politicaRevisaoValida, type PoliticaRevisaoManual } from '@scv/domain';

export interface ConfiguracaoApp {
  jwtSecret: string;
  encryptionKey: string;
  politicaRevisao: PoliticaRevisaoManual;
  authStore: 'memory' | 'prisma';
  uazapiBaseUrl: string;
  uazapiAdminToken: string;
  internalToken: string;
  apiPublicUrl: string;
  accessTtlSegundos: number;
  accessAdminTtlSegundos: number;
  refreshTtlSegundos: number;
  refreshAdminTtlSegundos: number;
  reauthTtlSegundos: number;
  bcryptRounds: number;
}

export function lerConfiguracao(env: NodeJS.ProcessEnv = process.env): ConfiguracaoApp {
  const politica = env.REVISAO_MANUAL_EMPRESA ?? 'falha';
  if (!politicaRevisaoValida(politica)) {
    throw new Error('REVISAO_MANUAL_EMPRESA deve ser sempre, falha ou nunca');
  }
  const jwtSecret =
    env.JWT_SECRET ?? (env.NODE_ENV === 'production' ? '' : 'dev-only-jwt-secret-change-me!!');
  if (!jwtSecret || jwtSecret.length < 16) {
    throw new Error('JWT_SECRET obrigatório');
  }
  const authStore =
    env.AUTH_STORE === 'memory' || env.AUTH_STORE === 'prisma'
      ? env.AUTH_STORE
      : env.NODE_ENV === 'test'
        ? 'memory'
        : 'prisma';

  return {
    jwtSecret,
    encryptionKey: env.APP_ENCRYPTION_KEY ?? '',
    politicaRevisao: politica,
    authStore,
    uazapiBaseUrl: env.UAZAPI_BASE_URL ?? '',
    uazapiAdminToken: env.UAZAPI_ADMIN_TOKEN ?? '',
    internalToken: env.INTERNAL_JOB_TOKEN ?? '',
    apiPublicUrl: env.API_PUBLIC_URL ?? 'http://localhost:3000',
    accessTtlSegundos: 15 * 60,
    accessAdminTtlSegundos: 5 * 60,
    refreshTtlSegundos: 14 * 24 * 60 * 60,
    refreshAdminTtlSegundos: 8 * 60 * 60,
    reauthTtlSegundos: 5 * 60,
    bcryptRounds: env.NODE_ENV === 'test' ? 4 : 10,
  };
}
