import type { PapelEmpresa, PapelGlobal, StatusEmpresa, Visao } from '@scv/domain';

import type {
  CandidaturaRegistro,
  HistoricoStatusRegistro,
  TransicaoCandidaturaRegistro,
} from './candidaturas-tipos';
import type { EntrevistaRegistro, SessaoVozRegistro } from './entrevistas-tipos';
import type {
  CandidatoSimilar,
  EntradaSugestaoMatch,
  ResultadoSugestaoMatch,
  SugestaoMatchRegistro,
  VagaSimilar,
} from './match-tipos';
import type { StatusSugestaoMatch } from './match-tipos';
import type {
  FiltroNotificacoes,
  NotificacaoNova,
  NotificacaoRegistro,
  PaginaNotificacoes,
  PreferenciaNotificacaoRegistro,
} from './notificacoes-tipos';
import type {
  EtapaPerguntaRegistro,
  EtapaRegistro,
  EventoVagaRegistro,
  FiltroVagaPublica,
  PerguntaRegistro,
  ProcessoRegistro,
  VagaHabilidadeRegistro,
  VagaRegistro,
} from './vagas-tipos';

export type {
  CandidaturaRegistro,
  HistoricoStatusRegistro,
  OrigemCandidatura,
  TransicaoCandidaturaRegistro,
} from './candidaturas-tipos';
export type {
  CandidatoSimilar,
  EntradaSugestaoMatch,
  ResultadoSugestaoMatch,
  StatusSugestaoMatch,
  SugestaoMatchRegistro,
  VagaSimilar,
} from './match-tipos';
export type {
  FiltroNotificacoes,
  NotificacaoNova,
  NotificacaoRegistro,
  PaginaNotificacoes,
  PreferenciaNotificacaoRegistro,
} from './notificacoes-tipos';
export type {
  EtapaPerguntaRegistro,
  EtapaRegistro,
  EventoVagaRegistro,
  FiltroVagaPublica,
  OrigemPergunta,
  PerguntaRegistro,
  ProcessoRegistro,
  SenioridadeVaga,
  StatusSugestao,
  TipoContrato,
  TipoEtapa,
  VagaHabilidadeRegistro,
  VagaRegistro,
} from './vagas-tipos';
export type {
  CanalEntrevista,
  EntrevistaRegistro,
  SessaoVozRegistro,
  StatusEntrevista,
  StatusSessaoVoz,
} from './entrevistas-tipos';

export interface ContextoTenant {
  empresaId?: string;
  isAdmin?: boolean;
  /** Job interno de prazo, sem usuário. Não substitui o bypass de admin. */
  sistema?: boolean;
  leituraPublica?: boolean;
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

export interface PerfilCandidato {
  id: string;
  usuarioId: string;
  nome: string;
  whatsapp: string | null;
  whatsappVerificado: boolean;
  whatsappVerificadoEm?: Date | null;
  linkedinUrl: string | null;
  perfil: Record<string, unknown>;
  visivelParaMatch: boolean;
}

export type OrigemHabilidade = 'MANUAL' | 'CV_EXTRAIDO' | 'SUGESTAO_IA';
export type StatusAntivirus = 'PENDENTE' | 'LIMPO' | 'INFECTADO';
export type MetodoExtracaoCurriculo = 'NATIVO' | 'OCR' | 'MISTO';
export type StatusProcessamentoCurriculo = 'PENDENTE' | 'PROCESSANDO' | 'CONCLUIDO' | 'FALHA';
export type TipoConsentimentoCandidato =
  'TERMOS' | 'WHATSAPP' | 'AUDIO_WHATSAPP' | 'GRAVACAO_VOZ' | 'AVALIACAO_IA' | 'VISIBILIDADE_MATCH';

export interface HabilidadeCatalogo {
  id: string;
  nome: string;
  categoria: string;
  sinonimos: string[];
}

export interface LinhaHabilidade {
  habilidadeId: string;
  nivel: number;
  anosExperiencia: number | null;
  origem: OrigemHabilidade;
}

export interface HabilidadeDoCandidato extends LinhaHabilidade {
  nome: string;
}

export interface CurriculoRegistro {
  id: string;
  candidatoId: string;
  arquivoKey: string;
  mimeType: string | null;
  tamanhoBytes: number | null;
  antivirusStatus: StatusAntivirus;
  metodoExtracao: MetodoExtracaoCurriculo | null;
  statusProcessamento: StatusProcessamentoCurriculo;
  confiancaOcr: number | null;
  textoExtraido: string | null;
  dadosExtraidos: Record<string, unknown> | null;
  confirmadoEm: Date | null;
  aplicadoAoPerfil: boolean;
  paginas: unknown;
  criadoEm: Date;
}

export interface ConsentimentoRegistro {
  id: string;
  candidatoId: string;
  tipo: TipoConsentimentoCandidato;
  concedido: boolean;
  versaoTermo: string;
  criadoEm: Date;
  candidaturaId?: string | null;
}

export interface SolicitacaoLgpdRegistro {
  id: string;
  usuarioId: string;
  candidatoId: string | null;
  tipo: 'EXPORTACAO' | 'EXCLUSAO';
  criadoEm: Date;
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

export type StatusEventoWhatsapp = 'RECEBIDO' | 'PROCESSADO' | 'IGNORADO';
export interface EventoWhatsappEntradaRegistro {
  id: string;
  empresaId: string;
  instanciaWhatsappId: string;
  mensagemIdProvedor: string;
  tipo: 'TEXTO' | 'AUDIO' | 'BOTAO' | 'MIDIA' | 'OUTRO';
  payloadNormalizado: Record<string, unknown>;
  status: StatusEventoWhatsapp;
  criadoEm: Date;
}

export interface RespostaSensivel {
  id: string;
  empresaId: string;
  entrevistaId?: string;
  etapaPerguntaId?: string;
  tipo?: 'AUDIO_WHATSAPP' | 'TEXTO_WHATSAPP' | 'VOZ_TEMPO_REAL';
  textoOriginal?: string | null;
  audioUrl: string | null;
  transcricao: string | null;
  mensagemIdProvedor?: string | null;
  duracaoSegundos?: number | null;
  confiancaTranscricao?: number | null;
  statusTranscricao?: 'PENDENTE' | 'PROCESSANDO' | 'CONCLUIDA' | 'FALHA';
  revisaoHumanaNecessaria?: boolean;
  parcial?: boolean;
  expirou?: boolean;
  tempoUsado?: number | null;
  criadoEm?: Date;
}

export interface ScoreRegistro {
  id: string;
  candidaturaId: string;
  scorePerfil: number | null;
  scoreHabilidades: number | null;
  scoreCurriculo: number | null;
  scoreLinkedin: number | null;
  scoreTriagem: number | null;
  scoreEntrevista: number | null;
  scoreFinal: number | null;
  completude: number | null;
  explicacao: Record<string, unknown>;
  versaoAlgoritmo: number;
  criadoEm: Date;
  atualizadoEm: Date;
}

export interface AvaliacaoRegistro {
  id: string;
  respostaId: string;
  avaliador: 'IA' | 'HUMANO';
  nota: number;
  criterios: Record<string, unknown>;
  justificativa: string | null;
  modelo: string | null;
  versaoPrompt: string | null;
  criadoEm: Date;
}

export interface QuedaInstanciaRegistro {
  id: string;
  empresaId: string;
  instanciaWhatsappId: string;
  inicioEm: Date;
  fimEm: Date | null;
  notificadaEm: Date | null;
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
  registrarDispositivoPush(registro: {
    usuarioId: string;
    token: string;
    plataforma: 'IOS' | 'ANDROID' | 'WEB';
    ultimoUsoEm: Date;
  }): Promise<void>;
  removerDispositivoPush(token: string, usuarioId: string): Promise<boolean>;
  listarDispositivosPush(usuarioId: string): Promise<Array<{ token: string; plataforma: string }>>;
  removerDispositivosPush(tokens: string[]): Promise<void>;
  removerDispositivosPushInativos(antesDe: Date): Promise<number>;
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
  buscarCandidatoPorId(id: string): Promise<CandidatoRegistro | null>;
  obterPerfil(usuarioId: string): Promise<PerfilCandidato | null>;
  salvarPerfil(perfil: PerfilCandidato): Promise<PerfilCandidato>;
  listarCatalogoHabilidades(): Promise<HabilidadeCatalogo[]>;
  listarHabilidades(candidatoId: string): Promise<HabilidadeDoCandidato[]>;
  listarLinhasHabilidade(candidatoId: string): Promise<LinhaHabilidade[]>;
  definirHabilidades(candidatoId: string, linhas: LinhaHabilidade[]): Promise<void>;
  criarCurriculo(curriculo: CurriculoRegistro): Promise<CurriculoRegistro>;
  buscarCurriculo(id: string): Promise<CurriculoRegistro | null>;
  buscarCurriculoPorKey(arquivoKey: string): Promise<CurriculoRegistro | null>;
  listarCurriculos(candidatoId: string): Promise<CurriculoRegistro[]>;
  atualizarCurriculo(id: string, patch: Partial<CurriculoRegistro>): Promise<CurriculoRegistro>;
  registrarConsentimento(registro: ConsentimentoRegistro): Promise<ConsentimentoRegistro>;
  listarConsentimentos(candidatoId: string): Promise<ConsentimentoRegistro[]>;
  registrarSolicitacaoLgpd(registro: SolicitacaoLgpdRegistro): Promise<void>;
  expurgarDadosCandidato(
    usuarioId: string,
    anon: { email: string; senhaHash: string; nome: string },
  ): Promise<{ arquivoKeys: string[] }>;
  registrarAuditoria(registro: AuditoriaRegistro, ctx: ContextoTenant): Promise<AuditoriaRegistro>;
  listarAuditoria(ctx: ContextoTenant, empresaId?: string): Promise<AuditoriaRegistro[]>;
  alterarAuditoria(): Promise<never>;
  salvarInstancia(instancia: InstanciaRegistro, ctx: ContextoTenant): Promise<InstanciaRegistro>;
  buscarInstanciaPorEmpresa(
    empresaId: string,
    ctx: ContextoTenant,
  ): Promise<InstanciaRegistro | null>;
  buscarInstanciaPorId(id: string, ctx: ContextoTenant): Promise<InstanciaRegistro | null>;
  listarInstancias(ctx: ContextoTenant): Promise<InstanciaRegistro[]>;
  criarEntrevista(dados: EntrevistaRegistro, ctx: ContextoTenant): Promise<EntrevistaRegistro>;
  buscarEntrevista(id: string, ctx: ContextoTenant): Promise<EntrevistaRegistro | null>;
  buscarEntrevistaPorCandidaturaEtapa(
    candidaturaId: string,
    etapaId: string,
    ctx: ContextoTenant,
  ): Promise<EntrevistaRegistro | null>;
  atualizarEntrevista(
    id: string,
    patch: Partial<EntrevistaRegistro>,
    ctx: ContextoTenant,
    esperadoAtualizadoEm?: Date,
  ): Promise<EntrevistaRegistro | null>;
  listarEntrevistas(ctx: ContextoTenant): Promise<EntrevistaRegistro[]>;
  criarSessaoVoz(dados: SessaoVozRegistro, ctx: ContextoTenant): Promise<SessaoVozRegistro>;
  buscarSessaoVoz(id: string, ctx: ContextoTenant): Promise<SessaoVozRegistro | null>;
  atualizarSessaoVoz(
    id: string,
    patch: Partial<SessaoVozRegistro>,
    ctx: ContextoTenant,
  ): Promise<SessaoVozRegistro | null>;
  listarSessoesEntrevista(entrevistaId: string, ctx: ContextoTenant): Promise<SessaoVozRegistro[]>;
  contarSessoesAtivas(ctx: ContextoTenant): Promise<number>;
  salvarScore(dados: ScoreRegistro, ctx: ContextoTenant): Promise<ScoreRegistro>;
  buscarScore(candidaturaId: string, ctx: ContextoTenant): Promise<ScoreRegistro | null>;
  listarScores(ctx: ContextoTenant): Promise<ScoreRegistro[]>;
  marcarRespostasParciais(entrevistaId: string, ctx: ContextoTenant): Promise<void>;
  registrarEventoWhatsappEntrada(
    registro: EventoWhatsappEntradaRegistro,
    ctx: ContextoTenant,
  ): Promise<EventoWhatsappEntradaRegistro | null>;
  buscarEventoWhatsappEntrada(
    id: string,
    ctx: ContextoTenant,
  ): Promise<EventoWhatsappEntradaRegistro | null>;
  atualizarEventoWhatsappEntrada(
    id: string,
    status: StatusEventoWhatsapp,
    ctx: ContextoTenant,
  ): Promise<void>;
  buscarPerfilPorWhatsapp(numero: string): Promise<PerfilCandidato | null>;
  listarUsuariosPorPapel(papel: PapelGlobal): Promise<UsuarioRegistro[]>;
  criarResposta(resposta: RespostaSensivel): Promise<void>;
  buscarRespostaPorMensagem(
    mensagemIdProvedor: string,
    ctx: ContextoTenant,
  ): Promise<RespostaSensivel | null>;
  salvarAvaliacao(avaliacao: AvaliacaoRegistro, ctx: ContextoTenant): Promise<void>;
  listarAvaliacoes(respostaId: string, ctx: ContextoTenant): Promise<AvaliacaoRegistro[]>;
  registrarQueda(queda: QuedaInstanciaRegistro, ctx: ContextoTenant): Promise<void>;
  quedaAberta(instanciaId: string, ctx: ContextoTenant): Promise<QuedaInstanciaRegistro | null>;
  encerrarQuedasAbertas(instanciaId: string, fimEm: Date, ctx: ContextoTenant): Promise<void>;
  pausarVagasPublicadas(empresaId: string, quando: Date, ctx: ContextoTenant): Promise<number>;
  buscarResposta(id: string, ctx: ContextoTenant): Promise<RespostaSensivel | null>;
  listarRespostasEntrevista(entrevistaId: string, ctx: ContextoTenant): Promise<RespostaSensivel[]>;
  guardarResposta(resposta: RespostaSensivel): Promise<void>;
  garantirHabilidade(nome: string, categoria?: string): Promise<HabilidadeCatalogo>;
  buscarHabilidade(id: string): Promise<HabilidadeCatalogo | null>;
  criarVaga(dados: VagaRegistro, ctx: ContextoTenant): Promise<VagaRegistro>;
  atualizarVaga(
    id: string,
    patch: Partial<VagaRegistro>,
    ctx: ContextoTenant,
  ): Promise<VagaRegistro | null>;
  buscarVaga(id: string, ctx: ContextoTenant): Promise<VagaRegistro | null>;
  listarVagasEmpresa(empresaId: string, ctx: ContextoTenant): Promise<VagaRegistro[]>;
  listarVagasPublicas(filtro: FiltroVagaPublica): Promise<VagaRegistro[]>;
  substituirHabilidades(
    vagaId: string,
    itens: VagaHabilidadeRegistro[],
    ctx: ContextoTenant,
  ): Promise<VagaHabilidadeRegistro[]>;
  listarHabilidadesVaga(vagaId: string, ctx: ContextoTenant): Promise<VagaHabilidadeRegistro[]>;
  salvarProcesso(dados: ProcessoRegistro, ctx: ContextoTenant): Promise<ProcessoRegistro>;
  buscarProcessoPorVaga(vagaId: string, ctx: ContextoTenant): Promise<ProcessoRegistro | null>;
  buscarProcessoPorId(id: string, ctx: ContextoTenant): Promise<ProcessoRegistro | null>;
  salvarEtapa(dados: EtapaRegistro, ctx: ContextoTenant): Promise<EtapaRegistro>;
  listarEtapas(processoId: string, ctx: ContextoTenant): Promise<EtapaRegistro[]>;
  buscarEtapa(id: string, ctx: ContextoTenant): Promise<EtapaRegistro | null>;
  removerEtapa(id: string, ctx: ContextoTenant): Promise<void>;
  criarPergunta(dados: PerguntaRegistro, ctx: ContextoTenant): Promise<PerguntaRegistro>;
  atualizarPergunta(
    id: string,
    patch: Partial<PerguntaRegistro>,
    ctx: ContextoTenant,
  ): Promise<PerguntaRegistro | null>;
  buscarPergunta(id: string, ctx: ContextoTenant): Promise<PerguntaRegistro | null>;
  listarPerguntasEmpresa(empresaId: string, ctx: ContextoTenant): Promise<PerguntaRegistro[]>;
  listarSugestoesEtapa(etapaId: string, ctx: ContextoTenant): Promise<PerguntaRegistro[]>;
  vincularPergunta(
    dados: EtapaPerguntaRegistro,
    ctx: ContextoTenant,
  ): Promise<EtapaPerguntaRegistro>;
  listarVinculosEtapa(etapaId: string, ctx: ContextoTenant): Promise<EtapaPerguntaRegistro[]>;
  registrarEventoVaga(evento: EventoVagaRegistro, ctx: ContextoTenant): Promise<EventoVagaRegistro>;
  buscarEventoVaga(id: string, ctx: ContextoTenant): Promise<EventoVagaRegistro | null>;
  marcarEventoConsumido(id: string, quando: Date, ctx: ContextoTenant): Promise<void>;
  listarEventosVaga(vagaId: string, ctx: ContextoTenant): Promise<EventoVagaRegistro[]>;
  listarPublicadasVencidas(agora: Date, ctx: ContextoTenant): Promise<VagaRegistro[]>;
  listarPausasParaAlerta(limite: Date, ctx: ContextoTenant): Promise<VagaRegistro[]>;
  criarCandidatura(
    dados: CandidaturaRegistro,
    historico: HistoricoStatusRegistro,
    ctx: ContextoTenant,
  ): Promise<CandidaturaRegistro>;
  buscarCandidatura(id: string, ctx: ContextoTenant): Promise<CandidaturaRegistro | null>;
  listarCandidaturasVaga(vagaId: string, ctx: ContextoTenant): Promise<CandidaturaRegistro[]>;
  listarCandidaturasCandidato(
    candidatoId: string,
    ctx: ContextoTenant,
  ): Promise<CandidaturaRegistro[]>;
  /** `null` quando o estado esperado mudou (conflito otimista) ou a candidatura não é visível. */
  transicionarCandidatura(
    transicao: TransicaoCandidaturaRegistro,
    ctx: ContextoTenant,
  ): Promise<CandidaturaRegistro | null>;
  listarHistoricoStatus(
    candidaturaId: string,
    ctx: ContextoTenant,
  ): Promise<HistoricoStatusRegistro[]>;
  /** `false` quando a vaga não existe ou não é visível no contexto. */
  salvarEmbeddingVaga(vagaId: string, vetor: number[], ctx: ContextoTenant): Promise<boolean>;
  salvarEmbeddingCandidato(candidatoId: string, vetor: number[]): Promise<boolean>;
  buscarCandidatosSimilares(
    vagaId: string,
    limite: number,
    ctx: ContextoTenant,
  ): Promise<CandidatoSimilar[]>;
  buscarVagasSimilares(candidatoId: string, agora: Date, limite: number): Promise<VagaSimilar[]>;
  registrarSugestao(
    entrada: EntradaSugestaoMatch,
    ctx: ContextoTenant,
  ): Promise<ResultadoSugestaoMatch | null>;
  listarSugestoesVaga(vagaId: string, ctx: ContextoTenant): Promise<SugestaoMatchRegistro[]>;
  listarSugestoesCandidato(
    candidatoId: string,
    ctx: ContextoTenant,
  ): Promise<SugestaoMatchRegistro[]>;
  buscarSugestao(id: string, ctx: ContextoTenant): Promise<SugestaoMatchRegistro | null>;
  atualizarStatusSugestao(
    id: string,
    status: StatusSugestaoMatch,
    ctx: ContextoTenant,
  ): Promise<SugestaoMatchRegistro | null>;
  /** Grava `notificadoEm` só se ainda estiver vazio. */
  marcarSugestaoNotificada(id: string, quando: Date, ctx: ContextoTenant): Promise<void>;
  /** `null` quando a `chaveDedup` já existe (dedup) ou o contexto não permite. */
  inserirNotificacaoUnica(
    dados: NotificacaoNova,
    ctx: ContextoTenant,
  ): Promise<NotificacaoRegistro | null>;
  /** Upsert por `chaveDedup`: cria com `agrupadas = 1` ou incrementa, troca `dados` e volta a não lida. */
  agruparNotificacao(
    dados: NotificacaoNova,
    ctx: ContextoTenant,
  ): Promise<NotificacaoRegistro | null>;
  listarNotificacoes(filtro: FiltroNotificacoes, ctx: ContextoTenant): Promise<PaginaNotificacoes>;
  marcarNotificacaoLida(
    id: string,
    usuarioId: string,
    quando: Date,
    ctx: ContextoTenant,
  ): Promise<NotificacaoRegistro | null>;
  marcarTodasLidas(
    usuarioId: string,
    empresaId: string | undefined,
    quando: Date,
    ctx: ContextoTenant,
  ): Promise<number>;
  listarPreferencias(
    usuarioId: string,
    empresaId: string,
    ctx: ContextoTenant,
  ): Promise<PreferenciaNotificacaoRegistro[]>;
  salvarPreferencia(
    preferencia: PreferenciaNotificacaoRegistro,
    ctx: ContextoTenant,
  ): Promise<PreferenciaNotificacaoRegistro | null>;
}
