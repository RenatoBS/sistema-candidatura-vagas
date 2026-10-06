/**
 * Contratos compartilhados (OpenAPI, Zod, tipos).
 */

export const API_VERSION = 'v1';

export {
  atualizarPerfilSchema,
  confirmarCurriculoSchema,
  consentimentoSchema,
  dadosExtraidosSchema,
  excluirDadosSchema,
  habilidadesCandidatoSchema,
  registrarCurriculoSchema,
  uploadCurriculoSchema,
} from './candidato';
export { openApiFase5 } from './openapi-fase5';

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
