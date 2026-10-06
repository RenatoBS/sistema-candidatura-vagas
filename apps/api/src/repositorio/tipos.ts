import type { PapelEmpresa, PapelGlobal, StatusEmpresa, Visao } from '@scv/domain';

export interface ContextoTenant {
  empresaId?: string;
  isAdmin?: boolean;
}

export type TipoToken = 'CONFIRMACAO_EMAIL' | 'RECUPERACAO_SENHA' | 'VERIFICACAO_EMAIL_EMPRESA';
export type TipoVerificacao = 'EMAIL' | 'DOMINIO' | 'CNPJ' | 'REVISAO_MANUAL';
export type StatusMembro = 'ATIVO' | 'CONVIDADO' | 'REMOVIDO';
export type StatusConvite = 'PENDENTE' | 'ACEITO' | 'REVOGADO' | 'EXPIRADO';
export type StatusInstancia = 'AGUARDANDO_QR' | 'CONECTADA' | 'DESCONECTADA';

export interface UsuarioRegistro {
  id: string;
  email: string;
  senhaHash: string;
  papeisGlobais: PapelGlobal[];
  mfaAtivo: boolean;
  mfaSecretCifrado: string | null;
  visaoPreferida: Visao;
  emailConfirmadoEm: Date | null;
}

export interface RefreshRegistro {
  id: string;
  usuarioId: string;
  familiaId: string;
  tokenHash: string;
  mfaVerificado: boolean;
  expiraEm: Date;
  revogadoEm: Date | null;
  substituidoEm: Date | null;
}

export interface TokenRegistro {
  id: string;
  usuarioId: string | null;
  empresaId: string | null;
  email: string;
  tipo: TipoToken;
  tokenHash: string;
  expiraEm: Date;
  usadoEm: Date | null;
}

export interface CodigoMfaRegistro {
  id: string;
  usuarioId: string;
  codigoHash: string;
  usadoEm: Date | null;
}

export interface EmpresaRegistro {
  id: string;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  dominio: string;
  responsavelNome: string;
  responsavelEmail: string;
  responsavelCargo: string | null;
  telefone: string | null;
  endereco: Record<string, unknown> | null;
  statusVerificacao: StatusEmpresa;
  verificadaEm: Date | null;
  configuracoes: Record<string, unknown>;
}

export interface VerificacaoRegistro {
  id: string;
  empresaId: string;
  tipo: TipoVerificacao;
  resultado: string;
  detalhes: Record<string, unknown>;
  revisorAdminId: string | null;
  motivo: string | null;
  criadoEm: Date;
}

export interface MembroRegistro {
  id: string;
  usuarioId: string;
  empresaId: string;
  papeis: PapelEmpresa[];
  status: StatusMembro;
}

export interface ConviteRegistro {
  id: string;
  empresaId: string;
  email: string;
  papeis: PapelEmpresa[];
  tokenHash: string;
  convidadoPorId: string;
  status: StatusConvite;
  expiraEm: Date;
  aceitoEm: Date | null;
}

export interface CandidatoRegistro {
  id: string;
  usuarioId: string;
  nome: string;
}

export interface AuditoriaRegistro {
  id: string;
  usuarioId: string;
  empresaId: string | null;
  papel: string;
  acao: string;
  recursoTipo: string;
  recursoId: string | null;
  motivo: string | null;
  criadoEm: Date;
}

export interface InstanciaRegistro {
  id: string;
  empresaId: string;
  instanciaIdProvedorCifrado: string;
  tokenCifrado: string;
  numero: string | null;
  status: StatusInstancia;
  ultimaConexaoEm: Date | null;
  desconectadaEm: Date | null;
}

export interface RespostaSensivel {
  id: string;
  empresaId: string;
  audioUrl: string | null;
  transcricao: string | null;
}

export interface VinculoUsuario {
  membroId: string;
  empresaId: string;
  papeis: PapelEmpresa[];
  status: StatusMembro;
  nomeFantasia: string;
  razaoSocial: string;
  statusVerificacao: StatusEmpresa;
}

export interface Repositorio {
  criarUsuario(dados: UsuarioRegistro): Promise<UsuarioRegistro>;
  buscarUsuarioPorEmail(email: string): Promise<UsuarioRegistro | null>;
  buscarUsuarioPorId(id: string): Promise<UsuarioRegistro | null>;
  atualizarUsuario(id: string, patch: Partial<UsuarioRegistro>): Promise<UsuarioRegistro>;
  salvarRefresh(registro: RefreshRegistro): Promise<void>;
  buscarRefreshPorHash(hash: string): Promise<RefreshRegistro | null>;
  marcarRefreshSubstituido(id: string, quando: Date): Promise<void>;
  revogarFamilia(familiaId: string, quando: Date): Promise<void>;
  revogarRefreshDoUsuario(usuarioId: string, quando: Date): Promise<void>;
  salvarToken(registro: TokenRegistro, ctx?: ContextoTenant): Promise<void>;
  buscarTokenPorHash(hash: string, ctx?: ContextoTenant): Promise<TokenRegistro | null>;
  marcarTokenUsado(id: string, quando: Date, ctx?: ContextoTenant): Promise<void>;
  substituirCodigosMfa(usuarioId: string, codigos: CodigoMfaRegistro[]): Promise<void>;
  consumirCodigoMfa(usuarioId: string, codigoHash: string, quando: Date): Promise<boolean>;
  cnpjExiste(cnpj: string): Promise<boolean>;
  criarEmpresaComResponsavel(empresa: EmpresaRegistro, membro: MembroRegistro): Promise<void>;
  buscarEmpresaPorId(id: string, ctx: ContextoTenant): Promise<EmpresaRegistro | null>;
  atualizarEmpresa(
    id: string,
    patch: Partial<EmpresaRegistro>,
    ctx: ContextoTenant,
  ): Promise<EmpresaRegistro>;
  listarEmpresas(ctx: ContextoTenant): Promise<EmpresaRegistro[]>;
  registrarVerificacao(registro: VerificacaoRegistro, ctx: ContextoTenant): Promise<void>;
  listarVerificacoes(empresaId: string, ctx: ContextoTenant): Promise<VerificacaoRegistro[]>;
  criarMembro(membro: MembroRegistro, ctx: ContextoTenant): Promise<MembroRegistro>;
  buscarMembro(
    usuarioId: string,
    empresaId: string,
    ctx: ContextoTenant,
  ): Promise<MembroRegistro | null>;
  listarMembros(empresaId: string, ctx: ContextoTenant): Promise<MembroRegistro[]>;
  atualizarMembro(
    id: string,
    patch: Partial<MembroRegistro>,
    ctx: ContextoTenant,
  ): Promise<MembroRegistro>;
  vinculosDoUsuario(usuarioId: string): Promise<VinculoUsuario[]>;
  criarConvite(convite: ConviteRegistro, ctx: ContextoTenant): Promise<ConviteRegistro>;
  buscarConvitePorHash(hash: string): Promise<ConviteRegistro | null>;
  listarConvites(empresaId: string, ctx: ContextoTenant): Promise<ConviteRegistro[]>;
  atualizarConvite(
    id: string,
    patch: Partial<ConviteRegistro>,
    ctx: ContextoTenant,
  ): Promise<ConviteRegistro>;
  criarCandidato(candidato: CandidatoRegistro): Promise<CandidatoRegistro>;
  buscarCandidatoPorUsuario(usuarioId: string): Promise<CandidatoRegistro | null>;
  registrarAuditoria(registro: AuditoriaRegistro, ctx: ContextoTenant): Promise<AuditoriaRegistro>;
  listarAuditoria(ctx: ContextoTenant, empresaId?: string): Promise<AuditoriaRegistro[]>;
  alterarAuditoria(): Promise<never>;
  salvarInstancia(instancia: InstanciaRegistro, ctx: ContextoTenant): Promise<InstanciaRegistro>;
  buscarInstanciaPorEmpresa(
    empresaId: string,
    ctx: ContextoTenant,
  ): Promise<InstanciaRegistro | null>;
  listarInstancias(ctx: ContextoTenant): Promise<InstanciaRegistro[]>;
  pausarVagasPublicadas(empresaId: string, quando: Date, ctx: ContextoTenant): Promise<number>;
  buscarResposta(id: string, ctx: ContextoTenant): Promise<RespostaSensivel | null>;
  guardarResposta(resposta: RespostaSensivel): Promise<void>;
}
