import {
  LIMIAR_MATCH_FORTE_PADRAO,
  limiarMatchValido,
  politicaRevisaoValida,
  type PoliticaRevisaoManual,
} from '@scv/domain';

export interface ConfiguracaoApp {
  jwtSecret: string;
  encryptionKey: string;
  politicaRevisao: PoliticaRevisaoManual;
  authStore: 'memory' | 'prisma';
  uazapiBaseUrl: string;
  uazapiAdminToken: string;
  uazapiWebhookSecret: string;
  internalToken: string;
  apiPublicUrl: string;
  accessTtlSegundos: number;
  accessAdminTtlSegundos: number;
  refreshTtlSegundos: number;
  refreshAdminTtlSegundos: number;
  reauthTtlSegundos: number;
  bcryptRounds: number;
  pausaMaxDias: number;
  /** Compatibilidade mínima para a sugestão virar match forte (MATCH_LIMIAR_FORTE). */
  matchLimiarForte: number;
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
    uazapiWebhookSecret: env.UAZAPI_WEBHOOK_SECRET ?? '',
    internalToken: env.INTERNAL_JOB_TOKEN ?? '',
    apiPublicUrl: env.API_PUBLIC_URL ?? 'http://localhost:3000',
    accessTtlSegundos: 15 * 60,
    accessAdminTtlSegundos: 5 * 60,
    refreshTtlSegundos: 14 * 24 * 60 * 60,
    refreshAdminTtlSegundos: 8 * 60 * 60,
    reauthTtlSegundos: 5 * 60,
    bcryptRounds: env.NODE_ENV === 'test' ? 4 : 10,
    pausaMaxDias: inteiroPositivo(env.PAUSA_MAX_DIAS, 30),
    matchLimiarForte: limiarMatch(env.MATCH_LIMIAR_FORTE),
  };
}

function limiarMatch(valor: string | undefined): number {
  if (!valor) return LIMIAR_MATCH_FORTE_PADRAO;
  const numero = Number(valor);
  if (!limiarMatchValido(numero))
    throw new Error('MATCH_LIMIAR_FORTE deve ser um número em (0, 1]');
  return numero;
}

function inteiroPositivo(valor: string | undefined, padrao: number): number {
  if (!valor) return padrao;
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero < 1 || numero > 365) {
    throw new Error('PAUSA_MAX_DIAS deve ser um inteiro entre 1 e 365');
  }
  return numero;
}
