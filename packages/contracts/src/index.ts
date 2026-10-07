/**
 * Contratos compartilhados (OpenAPI, Zod, tipos).
 */

export const API_VERSION = 'v1';

export {
  atualizarPerfilSchema,
  confirmarCurriculoSchema,
  consentimentoSchema,
  candidaturaDiretaSchema,
  conviteAceiteSchema,
  dadosExtraidosSchema,
  excluirDadosSchema,
  habilidadesCandidatoSchema,
  registrarCurriculoSchema,
  uploadCurriculoSchema,
} from './candidato';
export { openApiFase5 } from './openapi-fase5';
export { revisaoTriagemSchema, saidaAvaliacaoIaSchema } from './triagem';

export interface HealthResponse {
  status: 'ok';
  version: string;
  timestamp: string;
}

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
export {
  aceitarConviteSchema,
  cadastroEmpresaSchema,
  codigoVerificacaoSchema,
  conviteMembroSchema,
  motivoOpcionalSchema,
  motivoSchema,
} from './empresas';
export type {
  ExplicacaoMatchDto,
  StatusSugestaoMatch,
  SugestaoMatchDto,
  SugestoesMatchVagaResponse,
  VagaRecomendadaDto,
  VagasRecomendadasResponse,
} from './match';
export {
  preferenciasNotificacaoSchema,
  TIPOS_NOTIFICACAO_EMPRESA,
  type NotificacaoDto,
  type NotificacoesResponse,
} from './notificacoes';
export { openApi, openApiFase3, openApiFase4, openApiFase6Match, type CaminhoApi } from './openapi';
export {
  atualizarVagaSchema,
  criarPerguntaSchema,
  consultaRankingSchema,
  consultaVagasPublicasSchema,
  criarVagaSchema,
  erroPerguntasIncompletasSchema,
  fecharVagaSchema,
  prorrogarVagaSchema,
  revisarSugestaoSchema,
  salvarProcessoSchema,
  vincularPerguntaSchema,
  type AtualizarVagaInput,
  type CriarPerguntaInput,
  type CriarVagaInput,
  type ErroPerguntasIncompletas,
  type SalvarProcessoInput,
  type VincularPerguntaInput,
} from './vagas';
