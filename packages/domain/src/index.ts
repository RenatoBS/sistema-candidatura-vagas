/**
 * Regras puras de domínio.
 * Auth, papéis, verificação de empresa e CNPJ local entram na Fase 3.
 */

export const DOMAIN_PACKAGE_VERSION = '0.4.0';

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
export {
  assinaturaConfere,
  mimePorAssinatura,
  MIMES_CURRICULO,
  TAMANHO_MAX_CURRICULO_BYTES,
  validarDeclaracaoArquivo,
  type DeclaracaoArquivo,
  type MimeCurriculo,
} from './arquivo-curriculo';
export {
  consentimentosVigentes,
  tipoConsentimentoValido,
  TIPOS_CONSENTIMENTO,
  VERSAO_TERMOS_ATUAL,
  type RegistroConsentimento,
  type TipoConsentimento,
} from './consentimento';
export {
  dadosCurriculoValidos,
  dadosCurriculoVazios,
  lerDadosCurriculo,
  perfilAposConfirmacao,
  perfilSemDadosDeCurriculo,
  schemaDadosCurriculo,
  type DadosCurriculo,
  type ExperienciaCurriculo,
  type FormacaoCurriculo,
  type HabilidadeExtraida,
} from './dados-curriculo';
export {
  aplicarExtraidas,
  CATALOGO_BASE,
  habilidadesCitadasNoTexto,
  normalizarHabilidades,
  normalizarNomeHabilidade,
  substituirManuais,
  type HabilidadeNomeada,
  type ItemCatalogo,
  type LinhaHabilidade,
  type OrigemHabilidade,
} from './habilidades';
export { contemRanking, emailAnonimizado, NOME_TITULAR_EXCLUIDO } from './lgpd';
export { interpretarLinkedinUrl, type LeituraLinkedin } from './linkedin';
export {
  baixaConfiancaOcr,
  classificarPaginas,
  LIMIAR_CONFIANCA_OCR,
  mediaConfianca,
  MINIMO_CARACTERES_TEXTO_NATIVO,
  paginaPrecisaOcr,
  type MetodoExtracao,
  type PaginaNativa,
} from './paginas-curriculo';
export { senhaAtendePolitica } from './senha';
export { interpretarWhatsapp, type LeituraWhatsapp } from './whatsapp';
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
export {
  aceitaInscricoes,
  deveAlertarPausaLonga,
  EFEITOS_EVENTO_VAGA,
  formatarInstanteBrasilia,
  FUSO_EXIBICAO_VAGA,
  interpretarPrazo,
  NUMERO_PERGUNTAS_PADRAO,
  OFFSET_BRASILIA,
  PAUSA_MAX_DIAS_PADRAO,
  POLITICA_RETRY_PADRAO,
  processoPublicavel,
  TEMPO_PADRAO_PERGUNTA_SEGUNDOS,
  tempoLimiteEfetivo,
  transicionarVaga,
  visivelNaListaPublica,
  type ComandoVaga,
  type ErroTransicaoVaga,
  type EstadoVaga,
  type PoliticaRetry,
  type ResultadoTransicaoVaga,
  type StatusVaga,
  type TipoEventoVaga,
} from './vaga';
