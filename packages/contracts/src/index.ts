/**
 * Contratos compartilhados (OpenAPI, Zod, tipos).
 */

export const API_VERSION = 'v1';

export interface HealthResponse {
  status: 'ok';
  version: string;
  timestamp: string;
}

export {
  aceitarConviteSchema,
  cadastroEmpresaSchema,
  codigoVerificacaoSchema,
  conviteMembroSchema,
  motivoOpcionalSchema,
  motivoSchema,
} from './empresas';
export { openApiFase3, type CaminhoApi } from './openapi';
export {
  alterarVisaoSchema,
  cadastroAuthSchema,
  confirmarEmailSchema,
  emailSchema,
  loginSchema,
  mfaCodigoSchema,
  onboardingCandidatoSchema,
  reautenticarSchema,
  recuperarSenhaSchema,
  redefinirSenhaSchema,
  refreshSchema,
  senhaSchema,
  visaoSchema,
} from './auth';
