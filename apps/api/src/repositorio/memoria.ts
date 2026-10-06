import { ErroAplicacao } from '../erros';
import type {
  AuditoriaRegistro,
  CandidatoRegistro,
  CodigoMfaRegistro,
  ContextoTenant,
  ConviteRegistro,
  EmpresaRegistro,
  InstanciaRegistro,
  MembroRegistro,
  RefreshRegistro,
  Repositorio,
  RespostaSensivel,
  TokenRegistro,
  UsuarioRegistro,
  VerificacaoRegistro,
  VinculoUsuario,
} from './tipos';

function visivel(ctx: ContextoTenant | undefined, empresaId: string | null): boolean {
  if (!ctx || ctx.isAdmin) return true;
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
  candidatos = new Map<string, CandidatoRegistro>();
  auditorias: AuditoriaRegistro[] = [];
  instancias = new Map<string, InstanciaRegistro>();
  respostas = new Map<string, RespostaSensivel>();
  vagasPausadas = 0;

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
    this.auditorias = [];
    this.instancias.clear();
    this.respostas.clear();
    this.vagasPausadas = 0;
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
    this.candidatos.set(candidato.usuarioId, { ...candidato });
    return { ...candidato };
  }

  async buscarCandidatoPorUsuario(usuarioId: string): Promise<CandidatoRegistro | null> {
    const candidato = this.candidatos.get(usuarioId);
    return candidato ? { ...candidato } : null;
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

  async pausarVagasPublicadas(empresaId: string, _quando: Date, ctx: ContextoTenant): Promise<number> {
    if (!visivel(ctx, empresaId)) return 0;
    this.vagasPausadas += 1;
    return 1;
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
