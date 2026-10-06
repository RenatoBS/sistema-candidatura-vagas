/**
 * Regras puras de domínio.
 * Auth, papéis, verificação de empresa e CNPJ local entram na Fase 3.
 */

export const DOMAIN_PACKAGE_VERSION = '0.3.0';

export {
  cnpjDigitosValidos,
  normalizarRazaoSocial,
  razoesCompativeis,
  somenteDigitosCnpj,
} from './cnpj';
export {
  dominioDoEmail,
  ehDominioGenerico,
  emailConfirmaDominio,
  normalizarDominio,
  registroTxtEsperado,
  txtConfirmaDominio,
} from './dominio';
export {
  ACOES,
  bypassAdmin,
  decidirPermissao,
  PAPEIS_CONVIDAVEIS,
  papeisConviteValidos,
  type Acao,
  type Ator,
  type ContextoAcao,
  type DecisaoPermissao,
  type MembroAtor,
  type PapelEmpresa,
  type PapelGlobal,
  type StatusMembro,
  type Visao,
} from './permissoes';
export { senhaAtendePolitica } from './senha';
export {
  decidirAposChecagens,
  podePublicarVaga,
  politicaRevisaoValida,
  transicionarEmpresa,
  type AcaoEstadoEmpresa,
  type ChecagensEmpresa,
  type DecisaoVerificacao,
  type PoliticaRevisaoManual,
  type ResultadoChecagem,
  type StatusEmpresa,
} from './verificacao-empresa';
