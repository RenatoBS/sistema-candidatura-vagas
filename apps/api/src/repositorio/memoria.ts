import { CATALOGO_BASE } from '@scv/domain';

import { ErroAplicacao } from '../erros';
import { CandidaturasMemoria } from './candidaturas-memoria';
import { MatchMemoria } from './match-memoria';
import { NotificacoesMemoria } from './notificacoes-memoria';
import type {
  AuditoriaRegistro,
  CandidatoRegistro,
  CodigoMfaRegistro,
  ConsentimentoRegistro,
  ContextoTenant,
  ConviteRegistro,
  CurriculoRegistro,
  EmpresaRegistro,
  FiltroNotificacoes,
  HabilidadeCatalogo,
  HabilidadeDoCandidato,
  InstanciaRegistro,
  EventoWhatsappEntradaRegistro,
  LinhaHabilidade,
  MembroRegistro,
  NotificacaoNova,
  PerfilCandidato,
  PreferenciaNotificacaoRegistro,
  RefreshRegistro,
  Repositorio,
  RespostaSensivel,
  SolicitacaoLgpdRegistro,
  TokenRegistro,
  UsuarioRegistro,
  VerificacaoRegistro,
  VinculoUsuario,
} from './tipos';
import { VagasMemoria } from './vagas-memoria';

const CATALOGO_MEMORIA: HabilidadeCatalogo[] = CATALOGO_BASE.map((item, indice) => ({
  ...item,
  id: `00000000-0000-4000-8000-${String(indice + 1).padStart(12, '0')}`,
}));

function perfilInicial(candidato: CandidatoRegistro): PerfilCandidato {
  return {
    id: candidato.id,
    usuarioId: candidato.usuarioId,
    nome: candidato.nome,
    whatsapp: null,
    whatsappVerificado: false,
    linkedinUrl: null,
    perfil: {},
    // Q17 (provisória): opt-in, igual ao padrão da coluna no banco.
    visivelParaMatch: false,
  };
}

function visivel(ctx: ContextoTenant | undefined, empresaId: string | null): boolean {
  if (!ctx || ctx.isAdmin || ctx.sistema) return true;
  if (empresaId === null) return true;
  return ctx.empresaId === empresaId;
}

export class RepositorioMemoria implements Repositorio {
  dispositivosPush = new Map<
    string,
    { usuarioId: string; token: string; plataforma: 'IOS' | 'ANDROID' | 'WEB'; ultimoUsoEm: Date }
  >();
  usuarios = new Map<string, UsuarioRegistro>();
  refresh = new Map<string, RefreshRegistro>();
  tokens = new Map<string, TokenRegistro>();
  codigosMfa = new Map<string, CodigoMfaRegistro>();
  empresas = new Map<string, EmpresaRegistro>();
  verificacoes: VerificacaoRegistro[] = [];
  membros = new Map<string, MembroRegistro>();
  convites = new Map<string, ConviteRegistro>();
  candidatos = new Map<string, PerfilCandidato>();
  async registrarDispositivoPush(registro: {
    usuarioId: string;
    token: string;
    plataforma: 'IOS' | 'ANDROID' | 'WEB';
    ultimoUsoEm: Date;
  }): Promise<void> {
    this.dispositivosPush.set(registro.token, registro);
  }
  async removerDispositivoPush(token: string, usuarioId: string): Promise<boolean> {
    const atual = this.dispositivosPush.get(token);
    if (!atual || atual.usuarioId !== usuarioId) return false;
    return this.dispositivosPush.delete(token);
  }
  async listarDispositivosPush(usuarioId: string) {
    return [...this.dispositivosPush.values()].filter((d) => d.usuarioId === usuarioId);
  }
  async removerDispositivosPush(tokens: string[]): Promise<void> {
    for (const token of tokens) this.dispositivosPush.delete(token);
  }
  async removerDispositivosPushInativos(antesDe: Date): Promise<number> {
    let removidos = 0;
    for (const [token, dispositivo] of this.dispositivosPush)
      if (dispositivo.ultimoUsoEm < antesDe) {
        this.dispositivosPush.delete(token);
        removidos += 1;
      }
    return removidos;
  }
  linhasHabilidade: { candidatoId: string; linha: LinhaHabilidade }[] = [];
  curriculos = new Map<string, CurriculoRegistro>();
  consentimentos: ConsentimentoRegistro[] = [];
  solicitacoesLgpd: SolicitacaoLgpdRegistro[] = [];
  auditorias: AuditoriaRegistro[] = [];
  instancias = new Map<string, InstanciaRegistro>();
  eventosWhatsappEntrada = new Map<string, EventoWhatsappEntradaRegistro>();
  respostas = new Map<string, RespostaSensivel>();
  readonly vagasStore = new VagasMemoria();
  readonly candidaturasStore = new CandidaturasMemoria();
  readonly matchStore = new MatchMemoria({
    candidatos: () => this.candidatos.values(),
    habilidadesCandidato: (candidatoId) => this.listarHabilidades(candidatoId),
    vagas: () => this.vagasStore.vagas.values(),
    habilidadesVaga: (vagaId) =>
      this.vagasStore.habilidadesVaga.filter((item) => item.vagaId === vagaId),
  });
  readonly notificacoesStore = new NotificacoesMemoria({
    sugestoes: this.matchStore.sugestoes,
    empresaDaVaga: (vagaId) => this.vagasStore.vagas.get(vagaId)?.empresaId ?? null,
  });

  limpar(): void {
    this.usuarios.clear();
    this.refresh.clear();
    this.tokens.clear();
    this.codigosMfa.clear();
    this.empresas.clear();
    this.verificacoes = [];
    this.membros.clear();
    this.convites.clear();
    this.candidatos.clear();
    this.linhasHabilidade = [];
    this.curriculos.clear();
    this.consentimentos = [];
    this.solicitacoesLgpd = [];
    this.auditorias = [];
    this.instancias.clear();
    this.eventosWhatsappEntrada.clear();
    this.respostas.clear();
    this.vagasStore.limpar();
    this.candidaturasStore.limpar();
    this.matchStore.limpar();
    this.notificacoesStore.limpar();
  }

  async criarUsuario(dados: UsuarioRegistro): Promise<UsuarioRegistro> {
    if ([...this.usuarios.values()].some((usuario) => usuario.email === dados.email)) {
      throw new ErroAplicacao('EMAIL_EM_USO', 409, 'e-mail já cadastrado');
    }
    this.usuarios.set(dados.id, { ...dados });
    return { ...dados };
  }

  async buscarUsuarioPorEmail(email: string): Promise<UsuarioRegistro | null> {
    return [...this.usuarios.values()].find((usuario) => usuario.email === email) ?? null;
  }

  async buscarUsuarioPorId(id: string): Promise<UsuarioRegistro | null> {
    const usuario = this.usuarios.get(id);
    return usuario ? { ...usuario } : null;
  }

  async atualizarUsuario(id: string, patch: Partial<UsuarioRegistro>): Promise<UsuarioRegistro> {
    const atual = this.usuarios.get(id);
    if (!atual) throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'usuário não encontrado');
    const proximo = { ...atual, ...patch, id };
    this.usuarios.set(id, proximo);
    return { ...proximo };
  }

  async salvarRefresh(registro: RefreshRegistro): Promise<void> {
    this.refresh.set(registro.id, { ...registro });
  }

  async buscarRefreshPorHash(hash: string): Promise<RefreshRegistro | null> {
    return [...this.refresh.values()].find((item) => item.tokenHash === hash) ?? null;
  }

  async marcarRefreshSubstituido(id: string, quando: Date): Promise<void> {
    const atual = this.refresh.get(id);
    if (atual) atual.substituidoEm = quando;
  }

  async revogarFamilia(familiaId: string, quando: Date): Promise<void> {
    for (const item of this.refresh.values()) {
      if (item.familiaId === familiaId) item.revogadoEm = quando;
    }
  }

  async revogarRefreshDoUsuario(usuarioId: string, quando: Date): Promise<void> {
    for (const item of this.refresh.values()) {
      if (item.usuarioId === usuarioId) item.revogadoEm = quando;
    }
  }

  async salvarToken(registro: TokenRegistro, ctx?: ContextoTenant): Promise<void> {
    if (!visivel(ctx, registro.empresaId))
      throw new ErroAplicacao('SEM_PERMISSAO', 403, 'sem permissão');
    this.tokens.set(registro.id, { ...registro });
  }

  async buscarTokenPorHash(hash: string, ctx?: ContextoTenant): Promise<TokenRegistro | null> {
    const token = [...this.tokens.values()].find((item) => item.tokenHash === hash) ?? null;
    if (!token || !visivel(ctx, token.empresaId)) return null;
    return { ...token };
  }

  async marcarTokenUsado(id: string, quando: Date, ctx?: ContextoTenant): Promise<void> {
    const token = this.tokens.get(id);
    if (!token || !visivel(ctx, token.empresaId)) return;
    token.usadoEm = quando;
  }

  async substituirCodigosMfa(usuarioId: string, codigos: CodigoMfaRegistro[]): Promise<void> {
    for (const [id, codigo] of this.codigosMfa) {
      if (codigo.usuarioId === usuarioId) this.codigosMfa.delete(id);
    }
    for (const codigo of codigos) this.codigosMfa.set(codigo.id, { ...codigo });
  }

  async consumirCodigoMfa(usuarioId: string, codigoHash: string, quando: Date): Promise<boolean> {
    const codigo = [...this.codigosMfa.values()].find(
      (item) => item.usuarioId === usuarioId && item.codigoHash === codigoHash && !item.usadoEm,
    );
    if (!codigo) return false;
    codigo.usadoEm = quando;
    return true;
  }

  async cnpjExiste(cnpj: string): Promise<boolean> {
    return [...this.empresas.values()].some((empresa) => empresa.cnpj === cnpj);
  }

  async criarEmpresaComResponsavel(
    empresa: EmpresaRegistro,
    membro: MembroRegistro,
  ): Promise<void> {
    if (await this.cnpjExiste(empresa.cnpj)) {
      throw new ErroAplicacao('CNPJ_EM_USO', 409, 'CNPJ já cadastrado');
    }
    this.empresas.set(empresa.id, { ...empresa, configuracoes: { ...empresa.configuracoes } });
    this.membros.set(membro.id, { ...membro, papeis: [...membro.papeis] });
  }

  async buscarEmpresaPorId(id: string, ctx: ContextoTenant): Promise<EmpresaRegistro | null> {
    const empresa = this.empresas.get(id);
    if (!empresa || !visivel(ctx, empresa.id)) return null;
    return { ...empresa, configuracoes: { ...empresa.configuracoes } };
  }

  async atualizarEmpresa(
    id: string,
    patch: Partial<EmpresaRegistro>,
    ctx: ContextoTenant,
  ): Promise<EmpresaRegistro> {
    const atual = await this.buscarEmpresaPorId(id, ctx);
    if (!atual) throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'empresa não encontrada');
    const proximo = {
      ...atual,
      ...patch,
      id,
      configuracoes: patch.configuracoes ?? atual.configuracoes,
    };
    this.empresas.set(id, proximo);
    return { ...proximo, configuracoes: { ...proximo.configuracoes } };
  }

  async listarEmpresas(ctx: ContextoTenant): Promise<EmpresaRegistro[]> {
    return [...this.empresas.values()]
      .filter((empresa) => visivel(ctx, empresa.id))
      .map((empresa) => ({ ...empresa, configuracoes: { ...empresa.configuracoes } }));
  }

  async registrarVerificacao(registro: VerificacaoRegistro, ctx: ContextoTenant): Promise<void> {
    if (!visivel(ctx, registro.empresaId))
      throw new ErroAplicacao('SEM_PERMISSAO', 403, 'sem permissão');
    this.verificacoes.push({ ...registro, detalhes: { ...registro.detalhes } });
  }

  async listarVerificacoes(empresaId: string, ctx: ContextoTenant): Promise<VerificacaoRegistro[]> {
    if (!visivel(ctx, empresaId)) return [];
    return this.verificacoes
      .filter((item) => item.empresaId === empresaId)
      .map((item) => ({ ...item }));
  }

  async criarMembro(membro: MembroRegistro, ctx: ContextoTenant): Promise<MembroRegistro> {
    if (!visivel(ctx, membro.empresaId))
      throw new ErroAplicacao('SEM_PERMISSAO', 403, 'sem permissão');
    this.membros.set(membro.id, { ...membro, papeis: [...membro.papeis] });
    return { ...membro, papeis: [...membro.papeis] };
  }

  async buscarMembro(
    usuarioId: string,
    empresaId: string,
    ctx: ContextoTenant,
  ): Promise<MembroRegistro | null> {
    if (!visivel(ctx, empresaId)) return null;
    const membro = [...this.membros.values()].find(
      (item) => item.usuarioId === usuarioId && item.empresaId === empresaId,
    );
    return membro ? { ...membro, papeis: [...membro.papeis] } : null;
  }

  async listarMembros(empresaId: string, ctx: ContextoTenant): Promise<MembroRegistro[]> {
    if (!visivel(ctx, empresaId)) return [];
    return [...this.membros.values()]
      .filter((item) => item.empresaId === empresaId)
      .map((item) => ({ ...item, papeis: [...item.papeis] }));
  }

  async atualizarMembro(
    id: string,
    patch: Partial<MembroRegistro>,
    ctx: ContextoTenant,
  ): Promise<MembroRegistro> {
    const atual = this.membros.get(id);
    if (!atual || !visivel(ctx, atual.empresaId)) {
      throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'membro não encontrado');
    }
    const proximo = { ...atual, ...patch, id };
    this.membros.set(id, proximo);
    return { ...proximo, papeis: [...proximo.papeis] };
  }

  async vinculosDoUsuario(usuarioId: string): Promise<VinculoUsuario[]> {
    const saida: VinculoUsuario[] = [];
    for (const membro of this.membros.values()) {
      if (membro.usuarioId !== usuarioId || membro.status === 'REMOVIDO') continue;
      const empresa = this.empresas.get(membro.empresaId);
      if (!empresa) continue;
      saida.push({
        membroId: membro.id,
        empresaId: membro.empresaId,
        papeis: [...membro.papeis],
        status: membro.status,
        nomeFantasia: empresa.nomeFantasia,
        razaoSocial: empresa.razaoSocial,
        statusVerificacao: empresa.statusVerificacao,
      });
    }
    return saida;
  }

  async criarConvite(convite: ConviteRegistro, ctx: ContextoTenant): Promise<ConviteRegistro> {
    if (!visivel(ctx, convite.empresaId))
      throw new ErroAplicacao('SEM_PERMISSAO', 403, 'sem permissão');
    this.convites.set(convite.id, { ...convite, papeis: [...convite.papeis] });
    return { ...convite, papeis: [...convite.papeis] };
  }

  async buscarConvitePorHash(hash: string): Promise<ConviteRegistro | null> {
    const convite = [...this.convites.values()].find((item) => item.tokenHash === hash);
    return convite ? { ...convite, papeis: [...convite.papeis] } : null;
  }

  async listarConvites(empresaId: string, ctx: ContextoTenant): Promise<ConviteRegistro[]> {
    if (!visivel(ctx, empresaId)) return [];
    return [...this.convites.values()]
      .filter((item) => item.empresaId === empresaId)
      .map((item) => ({ ...item, papeis: [...item.papeis] }));
  }

  async atualizarConvite(
    id: string,
    patch: Partial<ConviteRegistro>,
    ctx: ContextoTenant,
  ): Promise<ConviteRegistro> {
    const atual = this.convites.get(id);
    if (!atual || !visivel(ctx, atual.empresaId)) {
      throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'convite não encontrado');
    }
    const proximo = { ...atual, ...patch, id };
    this.convites.set(id, proximo);
    return { ...proximo, papeis: [...proximo.papeis] };
  }

  async criarCandidato(candidato: CandidatoRegistro): Promise<CandidatoRegistro> {
    const perfil = perfilInicial(candidato);
    this.candidatos.set(candidato.usuarioId, perfil);
    return { id: perfil.id, usuarioId: perfil.usuarioId, nome: perfil.nome };
  }

  async buscarCandidatoPorUsuario(usuarioId: string): Promise<CandidatoRegistro | null> {
    const candidato = this.candidatos.get(usuarioId);
    return candidato
      ? { id: candidato.id, usuarioId: candidato.usuarioId, nome: candidato.nome }
      : null;
  }

  async buscarCandidatoPorId(id: string): Promise<CandidatoRegistro | null> {
    // `candidatos` é indexado por usuarioId.
    const item = [...this.candidatos.values()].find((candidato) => candidato.id === id);
    return item ? { id: item.id, usuarioId: item.usuarioId, nome: item.nome } : null;
  }

  async obterPerfil(usuarioId: string): Promise<PerfilCandidato | null> {
    const perfil = this.candidatos.get(usuarioId);
    return perfil ? { ...perfil, perfil: { ...perfil.perfil } } : null;
  }

  async salvarPerfil(perfil: PerfilCandidato): Promise<PerfilCandidato> {
    this.candidatos.set(perfil.usuarioId, { ...perfil, perfil: { ...perfil.perfil } });
    const salvo = await this.obterPerfil(perfil.usuarioId);
    if (!salvo) throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'perfil não encontrado');
    return salvo;
  }

  async listarCatalogoHabilidades(): Promise<HabilidadeCatalogo[]> {
    return CATALOGO_MEMORIA.map((item) => ({ ...item, sinonimos: [...item.sinonimos] }));
  }

  async listarLinhasHabilidade(candidatoId: string): Promise<LinhaHabilidade[]> {
    return this.linhasHabilidade
      .filter((item) => item.candidatoId === candidatoId)
      .map((item) => ({ ...item.linha }));
  }

  async listarHabilidades(candidatoId: string): Promise<HabilidadeDoCandidato[]> {
    const catalogo = new Map(CATALOGO_MEMORIA.map((item) => [item.id, item]));
    const linhas = await this.listarLinhasHabilidade(candidatoId);
    return linhas.map((linha) => ({
      ...linha,
      nome: catalogo.get(linha.habilidadeId)?.nome ?? '',
    }));
  }

  async definirHabilidades(candidatoId: string, linhas: LinhaHabilidade[]): Promise<void> {
    this.linhasHabilidade = this.linhasHabilidade.filter(
      (item) => item.candidatoId !== candidatoId,
    );
    for (const linha of linhas) this.linhasHabilidade.push({ candidatoId, linha: { ...linha } });
  }

  async criarCurriculo(curriculo: CurriculoRegistro): Promise<CurriculoRegistro> {
    this.curriculos.set(curriculo.id, { ...curriculo });
    return { ...curriculo };
  }

  async buscarCurriculo(id: string): Promise<CurriculoRegistro | null> {
    const curriculo = this.curriculos.get(id);
    return curriculo ? { ...curriculo } : null;
  }

  async buscarCurriculoPorKey(arquivoKey: string): Promise<CurriculoRegistro | null> {
    const curriculo = [...this.curriculos.values()].find((item) => item.arquivoKey === arquivoKey);
    return curriculo ? { ...curriculo } : null;
  }

  async listarCurriculos(candidatoId: string): Promise<CurriculoRegistro[]> {
    return [...this.curriculos.values()]
      .filter((item) => item.candidatoId === candidatoId)
      .map((item) => ({ ...item }))
      .sort((a, b) => b.criadoEm.getTime() - a.criadoEm.getTime());
  }

  async atualizarCurriculo(
    id: string,
    patch: Partial<CurriculoRegistro>,
  ): Promise<CurriculoRegistro> {
    const atual = this.curriculos.get(id);
    if (!atual) throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'currículo não encontrado');
    const proximo = { ...atual, ...patch, id };
    this.curriculos.set(id, proximo);
    return { ...proximo };
  }

  async registrarConsentimento(registro: ConsentimentoRegistro): Promise<ConsentimentoRegistro> {
    this.consentimentos.push({ ...registro });
    return { ...registro };
  }

  async listarConsentimentos(candidatoId: string): Promise<ConsentimentoRegistro[]> {
    return this.consentimentos
      .filter((item) => item.candidatoId === candidatoId)
      .map((item) => ({ ...item }));
  }

  async registrarSolicitacaoLgpd(registro: SolicitacaoLgpdRegistro): Promise<void> {
    this.solicitacoesLgpd.push({ ...registro });
  }

  async expurgarDadosCandidato(
    usuarioId: string,
    anon: { email: string; senhaHash: string; nome: string },
  ): Promise<{ arquivoKeys: string[] }> {
    const perfil = this.candidatos.get(usuarioId);
    if (!perfil) throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'candidato não encontrado');
    const usuario = this.usuarios.get(usuarioId);
    if (!usuario) throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'usuário não encontrado');
    const arquivoKeys = [...this.curriculos.values()]
      .filter((item) => item.candidatoId === perfil.id)
      .map((item) => item.arquivoKey);
    for (const [id, item] of this.curriculos) {
      if (item.candidatoId === perfil.id) this.curriculos.delete(id);
    }
    this.linhasHabilidade = this.linhasHabilidade.filter((item) => item.candidatoId !== perfil.id);
    this.consentimentos = this.consentimentos.filter((item) => item.candidatoId !== perfil.id);
    this.candidatos.set(usuarioId, {
      ...perfil,
      nome: anon.nome,
      whatsapp: null,
      whatsappVerificado: false,
      linkedinUrl: null,
      perfil: {},
      visivelParaMatch: false,
    });
    this.usuarios.set(usuarioId, { ...usuario, email: anon.email, senhaHash: anon.senhaHash });
    for (const [id, refresh] of this.refresh) {
      if (refresh.usuarioId === usuarioId && !refresh.revogadoEm) {
        this.refresh.set(id, { ...refresh, revogadoEm: new Date() });
      }
    }
    return { arquivoKeys };
  }

  async registrarAuditoria(
    registro: AuditoriaRegistro,
    ctx: ContextoTenant,
  ): Promise<AuditoriaRegistro> {
    if (!visivel(ctx, registro.empresaId))
      throw new ErroAplicacao('SEM_PERMISSAO', 403, 'sem permissão');
    this.auditorias.push({ ...registro });
    return { ...registro };
  }

  async listarAuditoria(ctx: ContextoTenant, empresaId?: string): Promise<AuditoriaRegistro[]> {
    return this.auditorias.filter((item) => {
      if (empresaId && item.empresaId !== empresaId) return false;
      return visivel(ctx, item.empresaId);
    });
  }

  async alterarAuditoria(): Promise<never> {
    throw new ErroAplicacao('AUDITORIA_APPEND_ONLY', 409, 'auditorias_acesso é append-only');
  }

  async salvarInstancia(
    instancia: InstanciaRegistro,
    ctx: ContextoTenant,
  ): Promise<InstanciaRegistro> {
    if (!visivel(ctx, instancia.empresaId))
      throw new ErroAplicacao('SEM_PERMISSAO', 403, 'sem permissão');
    this.instancias.set(instancia.empresaId, { ...instancia });
    return { ...instancia };
  }

  async buscarInstanciaPorEmpresa(
    empresaId: string,
    ctx: ContextoTenant,
  ): Promise<InstanciaRegistro | null> {
    if (!visivel(ctx, empresaId)) return null;
    const instancia = this.instancias.get(empresaId);
    return instancia ? { ...instancia } : null;
  }

  async buscarInstanciaPorId(id: string, ctx: ContextoTenant): Promise<InstanciaRegistro | null> {
    const instancia = this.instanciasById(id);
    return instancia && visivel(ctx, instancia.empresaId) ? { ...instancia } : null;
  }

  async registrarEventoWhatsappEntrada(
    registro: EventoWhatsappEntradaRegistro,
    ctx: ContextoTenant,
  ): Promise<EventoWhatsappEntradaRegistro | null> {
    if (!visivel(ctx, registro.empresaId))
      throw new ErroAplicacao('SEM_PERMISSAO', 403, 'sem permissão');
    const chave = `${registro.instanciaWhatsappId}:${registro.mensagemIdProvedor}`;
    if (this.eventosWhatsappEntrada.has(chave)) return null;
    this.eventosWhatsappEntrada.set(chave, {
      ...registro,
      payloadNormalizado: { ...registro.payloadNormalizado },
    });
    return { ...registro, payloadNormalizado: { ...registro.payloadNormalizado } };
  }

  async listarInstancias(ctx: ContextoTenant): Promise<InstanciaRegistro[]> {
    return [...this.instancias.values()]
      .filter((item) => visivel(ctx, item.empresaId))
      .map((item) => ({ ...item }));
  }

  async pausarVagasPublicadas(
    empresaId: string,
    quando: Date,
    ctx: ContextoTenant,
  ): Promise<number> {
    return this.vagasStore.pausarPublicadas(empresaId, quando, ctx);
  }

  /** Mesmo catálogo do perfil do candidato, como na tabela única do Prisma. */
  async garantirHabilidade(nome: string, categoria?: string): Promise<HabilidadeCatalogo> {
    const chave = nome.trim().toLowerCase();
    const doCatalogo = CATALOGO_MEMORIA.find((item) => item.nome.toLowerCase() === chave);
    if (doCatalogo) return { ...doCatalogo, sinonimos: [...doCatalogo.sinonimos] };
    return this.vagasStore.garantirHabilidade(nome, categoria);
  }

  async buscarHabilidade(id: string): Promise<HabilidadeCatalogo | null> {
    const doCatalogo = CATALOGO_MEMORIA.find((item) => item.id === id);
    if (doCatalogo) return { ...doCatalogo, sinonimos: [...doCatalogo.sinonimos] };
    return this.vagasStore.buscarHabilidade(id);
  }

  criarVaga(dados: Parameters<VagasMemoria['criarVaga']>[0], ctx: ContextoTenant) {
    return this.vagasStore.criarVaga(dados, ctx);
  }

  atualizarVaga(
    id: string,
    patch: Parameters<VagasMemoria['atualizarVaga']>[1],
    ctx: ContextoTenant,
  ) {
    return this.vagasStore.atualizarVaga(id, patch, ctx);
  }

  buscarVaga(id: string, ctx: ContextoTenant) {
    return this.vagasStore.buscarVaga(id, ctx);
  }

  listarVagasEmpresa(empresaId: string, ctx: ContextoTenant) {
    return this.vagasStore.listarVagasEmpresa(empresaId, ctx);
  }

  listarVagasPublicas(filtro: Parameters<VagasMemoria['listarVagasPublicas']>[0]) {
    return this.vagasStore.listarVagasPublicas(filtro);
  }

  substituirHabilidades(
    vagaId: string,
    itens: Parameters<VagasMemoria['substituirHabilidades']>[1],
    ctx: ContextoTenant,
  ) {
    return this.vagasStore.substituirHabilidades(vagaId, itens, ctx);
  }

  listarHabilidadesVaga(vagaId: string, ctx: ContextoTenant) {
    return this.vagasStore.listarHabilidadesVaga(vagaId, ctx);
  }

  salvarProcesso(dados: Parameters<VagasMemoria['salvarProcesso']>[0], ctx: ContextoTenant) {
    return this.vagasStore.salvarProcesso(dados, ctx);
  }

  buscarProcessoPorVaga(vagaId: string, ctx: ContextoTenant) {
    return this.vagasStore.buscarProcessoPorVaga(vagaId, ctx);
  }

  buscarProcessoPorId(id: string, ctx: ContextoTenant) {
    return this.vagasStore.buscarProcessoPorId(id, ctx);
  }

  salvarEtapa(dados: Parameters<VagasMemoria['salvarEtapa']>[0], ctx: ContextoTenant) {
    return this.vagasStore.salvarEtapa(dados, ctx);
  }

  listarEtapas(processoId: string, ctx: ContextoTenant) {
    return this.vagasStore.listarEtapas(processoId, ctx);
  }

  buscarEtapa(id: string, ctx: ContextoTenant) {
    return this.vagasStore.buscarEtapa(id, ctx);
  }

  removerEtapa(id: string, ctx: ContextoTenant) {
    return this.vagasStore.removerEtapa(id, ctx);
  }

  criarPergunta(dados: Parameters<VagasMemoria['criarPergunta']>[0], ctx: ContextoTenant) {
    return this.vagasStore.criarPergunta(dados, ctx);
  }

  atualizarPergunta(
    id: string,
    patch: Parameters<VagasMemoria['atualizarPergunta']>[1],
    ctx: ContextoTenant,
  ) {
    return this.vagasStore.atualizarPergunta(id, patch, ctx);
  }

  buscarPergunta(id: string, ctx: ContextoTenant) {
    return this.vagasStore.buscarPergunta(id, ctx);
  }

  listarPerguntasEmpresa(empresaId: string, ctx: ContextoTenant) {
    return this.vagasStore.listarPerguntasEmpresa(empresaId, ctx);
  }

  listarSugestoesEtapa(etapaId: string, ctx: ContextoTenant) {
    return this.vagasStore.listarSugestoesEtapa(etapaId, ctx);
  }

  vincularPergunta(dados: Parameters<VagasMemoria['vincularPergunta']>[0], ctx: ContextoTenant) {
    return this.vagasStore.vincularPergunta(dados, ctx);
  }

  listarVinculosEtapa(etapaId: string, ctx: ContextoTenant) {
    return this.vagasStore.listarVinculosEtapa(etapaId, ctx);
  }

  registrarEventoVaga(
    evento: Parameters<VagasMemoria['registrarEventoVaga']>[0],
    ctx: ContextoTenant,
  ) {
    return this.vagasStore.registrarEventoVaga(evento, ctx);
  }

  buscarEventoVaga(id: string, ctx: ContextoTenant) {
    return this.vagasStore.buscarEventoVaga(id, ctx);
  }

  marcarEventoConsumido(id: string, quando: Date, ctx: ContextoTenant) {
    return this.vagasStore.marcarEventoConsumido(id, quando, ctx);
  }

  listarEventosVaga(vagaId: string, ctx: ContextoTenant) {
    return this.vagasStore.listarEventosVaga(vagaId, ctx);
  }

  listarPublicadasVencidas(agora: Date, ctx: ContextoTenant) {
    return this.vagasStore.listarPublicadasVencidas(agora, ctx);
  }

  listarPausasParaAlerta(limite: Date, ctx: ContextoTenant) {
    return this.vagasStore.listarPausasParaAlerta(limite, ctx);
  }

  criarCandidatura(
    dados: Parameters<CandidaturasMemoria['criarCandidatura']>[0],
    historico: Parameters<CandidaturasMemoria['criarCandidatura']>[1],
    ctx: ContextoTenant,
  ) {
    return this.candidaturasStore.criarCandidatura(dados, historico, ctx);
  }

  buscarCandidatura(id: string, ctx: ContextoTenant) {
    return this.candidaturasStore.buscarCandidatura(id, ctx);
  }

  listarCandidaturasVaga(vagaId: string, ctx: ContextoTenant) {
    return this.candidaturasStore.listarCandidaturasVaga(vagaId, ctx);
  }

  listarCandidaturasCandidato(candidatoId: string, ctx: ContextoTenant) {
    return this.candidaturasStore.listarCandidaturasCandidato(candidatoId, ctx);
  }

  transicionarCandidatura(
    transicao: Parameters<CandidaturasMemoria['transicionarCandidatura']>[0],
    ctx: ContextoTenant,
  ) {
    return this.candidaturasStore.transicionarCandidatura(transicao, ctx);
  }

  listarHistoricoStatus(candidaturaId: string, ctx: ContextoTenant) {
    return this.candidaturasStore.listarHistoricoStatus(candidaturaId, ctx);
  }

  salvarEmbeddingVaga(vagaId: string, vetor: number[], ctx: ContextoTenant) {
    return this.matchStore.salvarEmbeddingVaga(vagaId, vetor, ctx);
  }

  salvarEmbeddingCandidato(candidatoId: string, vetor: number[]) {
    return this.matchStore.salvarEmbeddingCandidato(candidatoId, vetor);
  }

  buscarCandidatosSimilares(vagaId: string, limite: number, ctx: ContextoTenant) {
    return this.matchStore.buscarCandidatosSimilares(vagaId, limite, ctx);
  }

  buscarVagasSimilares(candidatoId: string, agora: Date, limite: number) {
    return this.matchStore.buscarVagasSimilares(candidatoId, agora, limite);
  }

  registrarSugestao(
    entrada: Parameters<MatchMemoria['registrarSugestao']>[0],
    ctx: ContextoTenant,
  ) {
    return this.matchStore.registrarSugestao(entrada, ctx);
  }

  listarSugestoesVaga(vagaId: string, ctx: ContextoTenant) {
    return this.matchStore.listarSugestoesVaga(vagaId, ctx);
  }

  listarSugestoesCandidato(candidatoId: string, ctx: ContextoTenant) {
    return this.matchStore.listarSugestoesCandidato(candidatoId, ctx);
  }

  buscarSugestao(id: string, ctx: ContextoTenant) {
    return this.notificacoesStore.buscarSugestao(id, ctx);
  }

  atualizarStatusSugestao(
    id: string,
    status: Parameters<MatchMemoria['atualizarStatusSugestao']>[1],
    ctx: ContextoTenant,
  ) {
    return this.matchStore.atualizarStatusSugestao(id, status, ctx);
  }

  marcarSugestaoNotificada(id: string, quando: Date, ctx: ContextoTenant) {
    return this.notificacoesStore.marcarSugestaoNotificada(id, quando, ctx);
  }

  inserirNotificacaoUnica(dados: NotificacaoNova, ctx: ContextoTenant) {
    return this.notificacoesStore.inserirNotificacaoUnica(dados, ctx);
  }

  agruparNotificacao(dados: NotificacaoNova, ctx: ContextoTenant) {
    return this.notificacoesStore.agruparNotificacao(dados, ctx);
  }

  listarNotificacoes(filtro: FiltroNotificacoes, ctx: ContextoTenant) {
    return this.notificacoesStore.listarNotificacoes(filtro, ctx);
  }

  marcarNotificacaoLida(id: string, usuarioId: string, quando: Date, ctx: ContextoTenant) {
    return this.notificacoesStore.marcarNotificacaoLida(id, usuarioId, quando, ctx);
  }

  marcarTodasLidas(
    usuarioId: string,
    empresaId: string | undefined,
    quando: Date,
    ctx: ContextoTenant,
  ) {
    return this.notificacoesStore.marcarTodasLidas(usuarioId, empresaId, quando, ctx);
  }

  listarPreferencias(usuarioId: string, empresaId: string, ctx: ContextoTenant) {
    return this.notificacoesStore.listarPreferencias(usuarioId, empresaId, ctx);
  }

  salvarPreferencia(preferencia: PreferenciaNotificacaoRegistro, ctx: ContextoTenant) {
    return this.notificacoesStore.salvarPreferencia(preferencia, ctx);
  }

  async buscarResposta(id: string, ctx: ContextoTenant): Promise<RespostaSensivel | null> {
    const resposta = this.respostas.get(id);
    if (!resposta || !visivel(ctx, resposta.empresaId)) return null;
    return { ...resposta };
  }

  async guardarResposta(resposta: RespostaSensivel): Promise<void> {
    this.respostas.set(resposta.id, { ...resposta });
  }

  private instanciaById(id: string): InstanciaRegistro | null {
    for (const instancia of this.instancias.values()) if (instancia.id === id) return instancia;
    return null;
  }
}
