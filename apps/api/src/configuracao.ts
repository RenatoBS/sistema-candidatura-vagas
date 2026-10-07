import {
  LIMIAR_MATCH_FORTE_PADRAO,
  limiarMatchValido,
  politicaRevisaoValida,
  type PoliticaRevisaoManual,
} from '@scv/domain';
import { envOu } from '@scv/env';
import { simuladorEntrevistaLigado } from '@scv/llm';

export interface ConfiguracaoApp {
  jwtSecret: string;
  encryptionKey: string;
  politicaRevisao: PoliticaRevisaoManual;
  authStore: 'memory' | 'prisma';
  /** Onde ficam os dados. Padrão = authStore; `SCV_REPOSITORIO=prisma` com AUTH_STORE=memory roda a API em Postgres real mantendo filas/provedores falsos (testes de RLS). */
  repositorio: 'memory' | 'prisma';
  uazapiBaseUrl: string;
  uazapiAdminToken: string;
  uazapiWebhookSecret: string;
  internalToken: string;
  apiPublicUrl: string;
  sttLimiarConfianca: number;
  accessTtlSegundos: number;
  accessAdminTtlSegundos: number;
  refreshTtlSegundos: number;
  refreshAdminTtlSegundos: number;
  reauthTtlSegundos: number;
  bcryptRounds: number;
  pausaMaxDias: number;
  /** Compatibilidade mínima para a sugestão virar match forte (MATCH_LIMIAR_FORTE). */
  matchLimiarForte: number;
  /** Chat e entrevistador falsos. Nunca verdadeiro em produção. */
  simuladorEntrevista: boolean;
}

export function lerConfiguracao(env: NodeJS.ProcessEnv = process.env): ConfiguracaoApp {
  const politica = envOu(env, 'REVISAO_MANUAL_EMPRESA', 'falha');
  if (!politicaRevisaoValida(politica)) {
    throw new Error('REVISAO_MANUAL_EMPRESA deve ser sempre, falha ou nunca');
  }
  const jwtSecret = envOu(env, 'JWT_SECRET', env.NODE_ENV === 'production' ? '' : 'dev-only-jwt-secret-change-me!!');
  if (!jwtSecret || jwtSecret.length < 16) {
    throw new Error('JWT_SECRET obrigatório');
  }
  const authStore =
    env.AUTH_STORE === 'memory' || env.AUTH_STORE === 'prisma'
      ? env.AUTH_STORE
      : env.NODE_ENV === 'test'
        ? 'memory'
        : 'prisma';

  const uazapiBaseUrl = envOu(env, 'UAZAPI_BASE_URL', '');
  const uazapiAdminToken = envOu(env, 'UAZAPI_ADMIN_TOKEN', '');
  const uazapiWebhookSecret = envOu(env, 'UAZAPI_WEBHOOK_SECRET', '');
  const apiPublicUrl = envOu(env, 'API_PUBLIC_URL', 'http://localhost:3000');
  const simuladorEntrevista = simuladorEntrevistaLigado(env);
  if ((uazapiBaseUrl || uazapiAdminToken || simuladorEntrevista) && !uazapiWebhookSecret) {
    throw new Error('UAZAPI_WEBHOOK_SECRET obrigatório quando UAZAPI_BASE_URL/UAZAPI_ADMIN_TOKEN estão configurados ou o simulador está ligado');
  }
  validarUrlPublica(apiPublicUrl, env.NODE_ENV);

  return {
    jwtSecret,
    encryptionKey: envOu(env, 'APP_ENCRYPTION_KEY', ''),
    politicaRevisao: politica,
    authStore,
    repositorio: repositorioDe(env, authStore),
    uazapiBaseUrl,
    uazapiAdminToken,
    uazapiWebhookSecret,
    internalToken: envOu(env, 'INTERNAL_JOB_TOKEN', ''),
    apiPublicUrl,
    sttLimiarConfianca: limiarConfianca(env.STT_LIMIAR_CONFIANCA),
    accessTtlSegundos: 15 * 60,
    accessAdminTtlSegundos: 5 * 60,
    refreshTtlSegundos: 14 * 24 * 60 * 60,
    refreshAdminTtlSegundos: 8 * 60 * 60,
    reauthTtlSegundos: 5 * 60,
    bcryptRounds: env.NODE_ENV === 'test' ? 4 : 10,
    pausaMaxDias: inteiroPositivo(env.PAUSA_MAX_DIAS, 30),
    matchLimiarForte: limiarMatch(env.MATCH_LIMIAR_FORTE),
    simuladorEntrevista,
  };
}

function repositorioDe(env: NodeJS.ProcessEnv, padrao: 'memory' | 'prisma'): 'memory' | 'prisma' {
  const valor = envOu(env, 'SCV_REPOSITORIO', padrao);
  if (valor !== 'memory' && valor !== 'prisma') throw new Error('SCV_REPOSITORIO deve ser memory ou prisma');
  return valor;
}

const HOSTS_LOCAIS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]']);

/** Fora de dev/test a Uazapi precisa alcançar a API: URL válida e não local. */
function validarUrlPublica(valor: string, ambiente: string | undefined): void {
  let url: URL;
  try {
    url = new URL(valor);
  } catch {
    throw new Error('API_PUBLIC_URL deve ser uma URL absoluta válida');
  }
  if (!ambiente || ambiente === 'development' || ambiente === 'test') return;
  if (HOSTS_LOCAIS.has(url.hostname) || url.hostname.endsWith('.localhost')) {
    throw new Error('API_PUBLIC_URL não pode apontar para localhost fora de desenvolvimento');
  }
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

function limiarConfianca(valor: string | undefined): number {
  if (!valor) return 0.6;
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero < 0 || numero > 1) {
    throw new Error('STT_LIMIAR_CONFIANCA deve ser um número entre 0 e 1');
  }
  return numero;
}
