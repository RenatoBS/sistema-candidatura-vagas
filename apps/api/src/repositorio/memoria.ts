import { CATALOGO_BASE } from '@scv/domain';

import { ErroAplicacao } from '../erros';
import { CandidaturasMemoria } from './candidaturas-memoria';
import type {
  AuditoriaRegistro,
  CandidatoRegistro,
  CodigoMfaRegistro,
  ConsentimentoRegistro,
  ContextoTenant,
  ConviteRegistro,
  CurriculoRegistro,
  EmpresaRegistro,
  HabilidadeCatalogo,
  HabilidadeDoCandidato,
  InstanciaRegistro,
  LinhaHabilidade,
  MembroRegistro,
  PerfilCandidato,
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
    visivelParaMatch: true,
  };
}

function visivel(ctx: ContextoTenant | undefined, empresaId: string | null): boolean {
  if (!ctx || ctx.isAdmin || ctx.sistema) return true;
  if (empresaId === null) return true;
  return ctx.empresaId === empresaId;
}

export class RepositorioMemoria implements Repositorio {
  usuarios = new Map<string, UsuarioRegistro>();
  refresh = new Map<string, RefreshRegistro>();
  tokens = new Map<string, TokenRegistro>();
  codigosMfa = new Map<string, CodigoMfaRegistro>();
  empresas = new Map<string, EmpresaRegistro>();
  verificacoes: VerificacaoRegistro[] = [];
  membros = new Map<string, MembroRegistro>();
  convites = new Map<string, ConviteRegistro>();
  candidatos = new Map<string, PerfilCandidato>();
  linhasHabilidade: { candidatoId: string; linha: LinhaHabilidade }[] = [];
  curriculos = new Map<string, CurriculoRegistro>();
  consentimentos: ConsentimentoRegistro[] = [];
  solicitacoesLgpd: SolicitacaoLgpdRegistro[] = [];
  auditorias: AuditoriaRegistro[] = [];
  instancias = new Map<string, InstanciaRegistro>();
  respostas = new Map<string, RespostaSensivel>();
  readonly vagasStore = new VagasMemoria();
  readonly candidaturasStore = new CandidaturasMemoria();

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
    this.respostas.clear();
    this.vagasStore.limpar();
    this.candidaturasStore.limpar();
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
    if (!visivel(ctx, registro.empresaId)) throw new ErroAplicacao('SEM_PERMISSAO', 403, 'sem permissão');
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

  async criarEmpresaComResponsavel(empresa: EmpresaRegistro, membro: MembroRegistro): Promise<void> {
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
    const proximo = { ...atual, ...patch, id, configuracoes: patch.configuracoes ?? atual.configuracoes };
    this.empresas.set(id, proximo);
    return { ...proximo, configuracoes: { ...proximo.configuracoes } };
  }

  async listarEmpresas(ctx: ContextoTenant): Promise<EmpresaRegistro[]> {
    return [...this.empresas.values()]
      .filter((empresa) => visivel(ctx, empresa.id))
      .map((empresa) => ({ ...empresa, configuracoes: { ...empresa.configuracoes } }));
  }

  async registrarVerificacao(registro: VerificacaoRegistro, ctx: ContextoTenant): Promise<void> {
    if (!visivel(ctx, registro.empresaId)) throw new ErroAplicacao('SEM_PERMISSAO', 403, 'sem permissão');
    this.verificacoes.push({ ...registro, detalhes: { ...registro.detalhes } });
  }

  async listarVerificacoes(empresaId: string, ctx: ContextoTenant): Promise<VerificacaoRegistro[]> {
    if (!visivel(ctx, empresaId)) return [];
    return this.verificacoes.filter((item) => item.empresaId === empresaId).map((item) => ({ ...item }));
  }

  async criarMembro(membro: MembroRegistro, ctx: ContextoTenant): Promise<MembroRegistro> {
    if (!visivel(ctx, membro.empresaId)) throw new ErroAplicacao('SEM_PERMISSAO', 403, 'sem permissão');
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
    if (!visivel(ctx, convite.empresaId)) throw new ErroAplicacao('SEM_PERMISSAO', 403, 'sem permissão');
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
    return candidato ? { id: candidato.id, usuarioId: candidato.usuarioId, nome: candidato.nome } : null;
  }

  async buscarCandidatoPorId(id: string): Promise<CandidatoRegistro | null> {
    const item = this.candidatos.get(id);
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
    return this.linhasHabilidade.filter((item) => item.candidatoId === candidatoId).map((item) => ({ ...item.linha }));
  }

  async listarHabilidades(candidatoId: string): Promise<HabilidadeDoCandidato[]> {
    const catalogo = new Map(CATALOGO_MEMORIA.map((item) => [item.id, item]));
    const linhas = await this.listarLinhasHabilidade(candidatoId);
    return linhas.map((linha) => ({ ...linha, nome: catalogo.get(linha.habilidadeId)?.nome ?? '' }));
  }

  async definirHabilidades(candidatoId: string, linhas: LinhaHabilidade[]): Promise<void> {
    this.linhasHabilidade = this.linhasHabilidade.filter((item) => item.candidatoId !== candidatoId);
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

  async atualizarCurriculo(id: string, patch: Partial<CurriculoRegistro>): Promise<CurriculoRegistro> {
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
    return this.consentimentos.filter((item) => item.candidatoId === candidatoId).map((item) => ({ ...item }));
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

  async registrarAuditoria(registro: AuditoriaRegistro, ctx: ContextoTenant): Promise<AuditoriaRegistro> {
    if (!visivel(ctx, registro.empresaId)) throw new ErroAplicacao('SEM_PERMISSAO', 403, 'sem permissão');
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

  async salvarInstancia(instancia: InstanciaRegistro, ctx: ContextoTenant): Promise<InstanciaRegistro> {
    if (!visivel(ctx, instancia.empresaId)) throw new ErroAplicacao('SEM_PERMISSAO', 403, 'sem permissão');
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

  async listarInstancias(ctx: ContextoTenant): Promise<InstanciaRegistro[]> {
    return [...this.instancias.values()]
      .filter((item) => visivel(ctx, item.empresaId))
      .map((item) => ({ ...item }));
  }

  async pausarVagasPublicadas(empresaId: string, quando: Date, ctx: ContextoTenant): Promise<number> {
    return this.vagasStore.pausarPublicadas(empresaId, quando, ctx);
  }

  garantirHabilidade(nome: string, categoria?: string) {
    return this.vagasStore.garantirHabilidade(nome, categoria);
  }

  buscarHabilidade(id: string) {
    return this.vagasStore.buscarHabilidade(id);
  }

  criarVaga(dados: Parameters<VagasMemoria['criarVaga']>[0], ctx: ContextoTenant) {
    return this.vagasStore.criarVaga(dados, ctx);
  }

  atualizarVaga(id: string, patch: Parameters<VagasMemoria['atualizarVaga']>[1], ctx: ContextoTenant) {
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

  substituirHabilidades(vagaId: string, itens: Parameters<VagasMemoria['substituirHabilidades']>[1], ctx: ContextoTenant) {
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

  atualizarPergunta(id: string, patch: Parameters<VagasMemoria['atualizarPergunta']>[1], ctx: ContextoTenant) {
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

  registrarEventoVaga(evento: Parameters<VagasMemoria['registrarEventoVaga']>[0], ctx: ContextoTenant) {
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

  criarCandidatura(dados: Parameters<CandidaturasMemoria['criarCandidatura']>[0], historico: Parameters<CandidaturasMemoria['criarCandidatura']>[1], ctx: ContextoTenant) {
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

  transicionarCandidatura(transicao: Parameters<CandidaturasMemoria['transicionarCandidatura']>[0], ctx: ContextoTenant) {
    return this.candidaturasStore.transicionarCandidatura(transicao, ctx);
  }

  listarHistoricoStatus(candidaturaId: string, ctx: ContextoTenant) {
    return this.candidaturasStore.listarHistoricoStatus(candidaturaId, ctx);
  }

  async buscarResposta(id: string, ctx: ContextoTenant): Promise<RespostaSensivel | null> {
    const resposta = this.respostas.get(id);
    if (!resposta || !visivel(ctx, resposta.empresaId)) return null;
    return { ...resposta };
  }

  async guardarResposta(resposta: RespostaSensivel): Promise<void> {
    this.respostas.set(resposta.id, { ...resposta });
  }
}
