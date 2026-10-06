import { Prisma, PrismaClient } from '@prisma/client';

import { ErroAplicacao } from '../erros';
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
import { VagasPrisma } from './vagas-prisma';

function semId<T extends { id?: string }>(patch: T): Omit<T, 'id'> {
  const copia = { ...patch };
  delete copia.id;
  return copia;
}

function objeto(valor: Prisma.JsonValue | null | undefined): Record<string, unknown> {
  if (valor && typeof valor === 'object' && !Array.isArray(valor)) return valor as Record<string, unknown>;
  return {};
}

function json(valor: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(valor ?? {})) as Prisma.InputJsonValue;
}

function objetoOuNulo(valor: Prisma.JsonValue | null): Record<string, unknown> | null {
  if (valor === null) return null;
  return objeto(valor);
}

export class RepositorioPrisma implements Repositorio {
  private readonly vagasStore: VagasPrisma;

  constructor(private readonly prisma = new PrismaClient()) {
    this.vagasStore = new VagasPrisma(this.prisma, (ctx, fn) => this.comTenant(ctx, fn));
  }

  private async comTenant<T>(ctx: ContextoTenant, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        SELECT
          set_config('app.empresa_id', ${ctx.empresaId ?? ''}, true),
          set_config('app.is_admin', ${ctx.isAdmin ? 'true' : 'false'}, true),
          set_config('app.is_system', ${ctx.sistema ? 'true' : 'false'}, true),
          set_config('app.leitura_publica', ${ctx.leituraPublica ? 'true' : 'false'}, true)
      `;
      return fn(tx);
    });
  }

  async criarUsuario(dados: UsuarioRegistro): Promise<UsuarioRegistro> {
    try {
      const criado = await this.prisma.usuario.create({ data: dados });
      return this.usuario(criado);
    } catch (erro) {
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002') {
        throw new ErroAplicacao('EMAIL_EM_USO', 409, 'e-mail já cadastrado');
      }
      throw erro;
    }
  }

  async buscarUsuarioPorEmail(email: string): Promise<UsuarioRegistro | null> {
    const usuario = await this.prisma.usuario.findUnique({ where: { email } });
    return usuario ? this.usuario(usuario) : null;
  }

  async buscarUsuarioPorId(id: string): Promise<UsuarioRegistro | null> {
    const usuario = await this.prisma.usuario.findUnique({ where: { id } });
    return usuario ? this.usuario(usuario) : null;
  }

  async atualizarUsuario(id: string, patch: Partial<UsuarioRegistro>): Promise<UsuarioRegistro> {
    const data = semId(patch);
    const usuario = await this.prisma.usuario.update({ where: { id }, data });
    return this.usuario(usuario);
  }

  async salvarRefresh(registro: RefreshRegistro): Promise<void> {
    await this.prisma.refreshToken.create({ data: registro });
  }

  async buscarRefreshPorHash(hash: string): Promise<RefreshRegistro | null> {
    return this.prisma.refreshToken.findUnique({ where: { tokenHash: hash } });
  }

  async marcarRefreshSubstituido(id: string, quando: Date): Promise<void> {
    await this.prisma.refreshToken.update({ where: { id }, data: { substituidoEm: quando } });
  }

  async revogarFamilia(familiaId: string, quando: Date): Promise<void> {
    await this.prisma.refreshToken.updateMany({ where: { familiaId }, data: { revogadoEm: quando } });
  }

  async revogarRefreshDoUsuario(usuarioId: string, quando: Date): Promise<void> {
    await this.prisma.refreshToken.updateMany({ where: { usuarioId }, data: { revogadoEm: quando } });
  }

  async salvarToken(registro: TokenRegistro, ctx: ContextoTenant = {}): Promise<void> {
    await this.comTenant(ctx.empresaId ? ctx : {}, (tx) => tx.tokenUsoUnico.create({ data: registro }));
  }

  async buscarTokenPorHash(hash: string, ctx: ContextoTenant = {}): Promise<TokenRegistro | null> {
    return this.comTenant(ctx, (tx) => tx.tokenUsoUnico.findUnique({ where: { tokenHash: hash } }));
  }

  async marcarTokenUsado(id: string, quando: Date, ctx: ContextoTenant = {}): Promise<void> {
    await this.comTenant(ctx, (tx) => tx.tokenUsoUnico.update({ where: { id }, data: { usadoEm: quando } }));
  }

  async substituirCodigosMfa(usuarioId: string, codigos: CodigoMfaRegistro[]): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.codigoRecuperacaoMfa.deleteMany({ where: { usuarioId } }),
      this.prisma.codigoRecuperacaoMfa.createMany({ data: codigos }),
    ]);
  }

  async consumirCodigoMfa(usuarioId: string, codigoHash: string, quando: Date): Promise<boolean> {
    const codigo = await this.prisma.codigoRecuperacaoMfa.findFirst({
      where: { usuarioId, codigoHash, usadoEm: null },
    });
    if (!codigo) return false;
    await this.prisma.codigoRecuperacaoMfa.update({ where: { id: codigo.id }, data: { usadoEm: quando } });
    return true;
  }

  async cnpjExiste(cnpj: string): Promise<boolean> {
    const linhas = await this.prisma.$queryRaw<Array<{ existe: boolean }>>`
      SELECT app_cnpj_existe(${cnpj}) AS existe
    `;
    return linhas[0]?.existe === true;
  }

  async criarEmpresaComResponsavel(empresa: EmpresaRegistro, membro: MembroRegistro): Promise<void> {
    await this.comTenant({ empresaId: empresa.id }, async (tx) => {
      await tx.empresa.create({
        data: {
          ...empresa,
          endereco: empresa.endereco === null ? Prisma.JsonNull : (empresa.endereco as Prisma.InputJsonValue),
          configuracoes: empresa.configuracoes as Prisma.InputJsonValue,
        },
      });
      await tx.membroEmpresa.create({ data: membro });
    });
  }

  async buscarEmpresaPorId(id: string, ctx: ContextoTenant): Promise<EmpresaRegistro | null> {
    const empresa = await this.comTenant(ctx, (tx) => tx.empresa.findUnique({ where: { id } }));
    return empresa ? this.empresa(empresa) : null;
  }

  async atualizarEmpresa(id: string, patch: Partial<EmpresaRegistro>, ctx: ContextoTenant): Promise<EmpresaRegistro> {
    const data: Prisma.EmpresaUpdateInput = {};
    if (patch.razaoSocial !== undefined) data.razaoSocial = patch.razaoSocial;
    if (patch.nomeFantasia !== undefined) data.nomeFantasia = patch.nomeFantasia;
    if (patch.cnpj !== undefined) data.cnpj = patch.cnpj;
    if (patch.dominio !== undefined) data.dominio = patch.dominio;
    if (patch.responsavelNome !== undefined) data.responsavelNome = patch.responsavelNome;
    if (patch.responsavelEmail !== undefined) data.responsavelEmail = patch.responsavelEmail;
    if (patch.responsavelCargo !== undefined) data.responsavelCargo = patch.responsavelCargo;
    if (patch.telefone !== undefined) data.telefone = patch.telefone;
    if (patch.statusVerificacao !== undefined) data.statusVerificacao = patch.statusVerificacao;
    if (patch.verificadaEm !== undefined) data.verificadaEm = patch.verificadaEm;
    if (patch.endereco !== undefined) {
      data.endereco = patch.endereco === null ? Prisma.JsonNull : (patch.endereco as Prisma.InputJsonValue);
    }
    if (patch.configuracoes !== undefined) data.configuracoes = patch.configuracoes as Prisma.InputJsonValue;
    const empresa = await this.comTenant(ctx, (tx) => tx.empresa.update({ where: { id }, data }));
    return this.empresa(empresa);
  }

  async listarEmpresas(ctx: ContextoTenant): Promise<EmpresaRegistro[]> {
    const empresas = await this.comTenant(ctx, (tx) => tx.empresa.findMany({ orderBy: { criadoEm: 'asc' } }));
    return empresas.map((empresa) => this.empresa(empresa));
  }

  async registrarVerificacao(registro: VerificacaoRegistro, ctx: ContextoTenant): Promise<void> {
    await this.comTenant(ctx, (tx) =>
      tx.verificacaoEmpresa.create({
        data: { ...registro, detalhes: registro.detalhes as Prisma.InputJsonValue },
      }),
    );
  }

  async listarVerificacoes(empresaId: string, ctx: ContextoTenant): Promise<VerificacaoRegistro[]> {
    const itens = await this.comTenant(ctx, (tx) =>
      tx.verificacaoEmpresa.findMany({ where: { empresaId }, orderBy: { criadoEm: 'asc' } }),
    );
    return itens.map((item) => ({ ...item, detalhes: objeto(item.detalhes) }));
  }

  async criarMembro(membro: MembroRegistro, ctx: ContextoTenant): Promise<MembroRegistro> {
    return this.comTenant(ctx, (tx) => tx.membroEmpresa.create({ data: membro }));
  }

  async buscarMembro(usuarioId: string, empresaId: string, ctx: ContextoTenant): Promise<MembroRegistro | null> {
    return this.comTenant(ctx, (tx) => tx.membroEmpresa.findUnique({ where: { usuarioId_empresaId: { usuarioId, empresaId } } }));
  }

  async listarMembros(empresaId: string, ctx: ContextoTenant): Promise<MembroRegistro[]> {
    return this.comTenant(ctx, (tx) => tx.membroEmpresa.findMany({ where: { empresaId } }));
  }

  async atualizarMembro(id: string, patch: Partial<MembroRegistro>, ctx: ContextoTenant): Promise<MembroRegistro> {
    const data = semId(patch);
    return this.comTenant(ctx, (tx) => tx.membroEmpresa.update({ where: { id }, data }));
  }

  async vinculosDoUsuario(usuarioId: string): Promise<VinculoUsuario[]> {
    return this.prisma.$queryRaw<VinculoUsuario[]>`
      SELECT "membroId", "empresaId", papeis, status, "nomeFantasia", "razaoSocial", "statusVerificacao"
      FROM app_vinculos_do_usuario(CAST(${usuarioId} AS uuid))
    `;
  }

  async criarConvite(convite: ConviteRegistro, ctx: ContextoTenant): Promise<ConviteRegistro> {
    return this.comTenant(ctx, (tx) => tx.conviteMembro.create({ data: convite }));
  }

  async buscarConvitePorHash(hash: string): Promise<ConviteRegistro | null> {
    const linhas = await this.prisma.$queryRaw<ConviteRegistro[]>`
      SELECT id, "empresaId", email, papeis, "tokenHash", "convidadoPorId", status, "expiraEm", "aceitoEm"
      FROM app_buscar_convite_por_token_hash(${hash})
    `;
    return linhas[0] ?? null;
  }

  async listarConvites(empresaId: string, ctx: ContextoTenant): Promise<ConviteRegistro[]> {
    return this.comTenant(ctx, (tx) => tx.conviteMembro.findMany({ where: { empresaId } }));
  }

  async atualizarConvite(id: string, patch: Partial<ConviteRegistro>, ctx: ContextoTenant): Promise<ConviteRegistro> {
    const data = semId(patch);
    return this.comTenant(ctx, (tx) => tx.conviteMembro.update({ where: { id }, data }));
  }

  async criarCandidato(candidato: CandidatoRegistro): Promise<CandidatoRegistro> {
    const criado = await this.prisma.candidato.create({
      data: { id: candidato.id, usuarioId: candidato.usuarioId, nome: candidato.nome },
    });
    return { id: criado.id, usuarioId: criado.usuarioId, nome: criado.nome };
  }

  async buscarCandidatoPorUsuario(usuarioId: string): Promise<CandidatoRegistro | null> {
    const candidato = await this.prisma.candidato.findUnique({ where: { usuarioId } });
    return candidato ? { id: candidato.id, usuarioId: candidato.usuarioId, nome: candidato.nome } : null;
  }

  async obterPerfil(usuarioId: string): Promise<PerfilCandidato | null> {
    const candidato = await this.prisma.candidato.findUnique({ where: { usuarioId } });
    return candidato ? this.perfil(candidato) : null;
  }

  async salvarPerfil(perfil: PerfilCandidato): Promise<PerfilCandidato> {
    const candidato = await this.prisma.candidato.update({
      where: { id: perfil.id },
      data: {
        nome: perfil.nome,
        whatsapp: perfil.whatsapp,
        whatsappVerificado: perfil.whatsappVerificado,
        linkedinUrl: perfil.linkedinUrl,
        visivelParaMatch: perfil.visivelParaMatch,
        perfil: json(perfil.perfil),
      },
    });
    return this.perfil(candidato);
  }

  async listarCatalogoHabilidades(): Promise<HabilidadeCatalogo[]> {
    const itens = await this.prisma.habilidade.findMany({ orderBy: { nome: 'asc' } });
    return itens.map((item) => ({
      id: item.id,
      nome: item.nome,
      categoria: item.categoria,
      sinonimos: item.sinonimos,
    }));
  }

  async listarLinhasHabilidade(candidatoId: string): Promise<LinhaHabilidade[]> {
    const linhas = await this.prisma.candidatoHabilidade.findMany({ where: { candidatoId } });
    return linhas.map((linha) => ({
      habilidadeId: linha.habilidadeId,
      nivel: linha.nivel,
      anosExperiencia: linha.anosExperiencia,
      origem: linha.origem,
    }));
  }

  async listarHabilidades(candidatoId: string): Promise<HabilidadeDoCandidato[]> {
    const linhas = await this.prisma.candidatoHabilidade.findMany({
      where: { candidatoId },
      include: { habilidade: true },
    });
    return linhas.map((linha) => ({
      habilidadeId: linha.habilidadeId,
      nome: linha.habilidade.nome,
      nivel: linha.nivel,
      anosExperiencia: linha.anosExperiencia,
      origem: linha.origem,
    }));
  }

  async definirHabilidades(candidatoId: string, linhas: LinhaHabilidade[]): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.candidatoHabilidade.deleteMany({ where: { candidatoId } }),
      this.prisma.candidatoHabilidade.createMany({
        data: linhas.map((linha) => ({ candidatoId, ...linha })),
      }),
    ]);
  }

  async criarCurriculo(curriculo: CurriculoRegistro): Promise<CurriculoRegistro> {
    const criado = await this.prisma.curriculo.create({
      data: {
        id: curriculo.id,
        candidatoId: curriculo.candidatoId,
        arquivoKey: curriculo.arquivoKey,
        mimeType: curriculo.mimeType,
        tamanhoBytes: curriculo.tamanhoBytes,
        antivirusStatus: curriculo.antivirusStatus,
        metodoExtracao: curriculo.metodoExtracao,
        statusProcessamento: curriculo.statusProcessamento,
        confiancaOcr: curriculo.confiancaOcr,
        textoExtraido: curriculo.textoExtraido,
        dadosExtraidos: curriculo.dadosExtraidos ? json(curriculo.dadosExtraidos) : undefined,
        confirmadoEm: curriculo.confirmadoEm,
        aplicadoAoPerfil: curriculo.aplicadoAoPerfil,
        paginas: curriculo.paginas ? json(curriculo.paginas) : undefined,
        criadoEm: curriculo.criadoEm,
      },
    });
    return this.curriculo(criado);
  }

  async buscarCurriculo(id: string): Promise<CurriculoRegistro | null> {
    const curriculo = await this.prisma.curriculo.findUnique({ where: { id } });
    return curriculo ? this.curriculo(curriculo) : null;
  }

  async buscarCurriculoPorKey(arquivoKey: string): Promise<CurriculoRegistro | null> {
    const curriculo = await this.prisma.curriculo.findUnique({ where: { arquivoKey } });
    return curriculo ? this.curriculo(curriculo) : null;
  }

  async listarCurriculos(candidatoId: string): Promise<CurriculoRegistro[]> {
    const itens = await this.prisma.curriculo.findMany({ where: { candidatoId }, orderBy: { criadoEm: 'desc' } });
    return itens.map((item) => this.curriculo(item));
  }

  async atualizarCurriculo(id: string, patch: Partial<CurriculoRegistro>): Promise<CurriculoRegistro> {
    const data: Prisma.CurriculoUpdateInput = {};
    if (patch.mimeType !== undefined) data.mimeType = patch.mimeType;
    if (patch.tamanhoBytes !== undefined) data.tamanhoBytes = patch.tamanhoBytes;
    if (patch.antivirusStatus !== undefined) data.antivirusStatus = patch.antivirusStatus;
    if (patch.metodoExtracao !== undefined) data.metodoExtracao = patch.metodoExtracao;
    if (patch.statusProcessamento !== undefined) data.statusProcessamento = patch.statusProcessamento;
    if (patch.confiancaOcr !== undefined) data.confiancaOcr = patch.confiancaOcr;
    if (patch.textoExtraido !== undefined) data.textoExtraido = patch.textoExtraido;
    if (patch.dadosExtraidos !== undefined) data.dadosExtraidos = patch.dadosExtraidos ? json(patch.dadosExtraidos) : Prisma.JsonNull;
    if (patch.confirmadoEm !== undefined) data.confirmadoEm = patch.confirmadoEm;
    if (patch.aplicadoAoPerfil !== undefined) data.aplicadoAoPerfil = patch.aplicadoAoPerfil;
    if (patch.paginas !== undefined) data.paginas = patch.paginas ? json(patch.paginas) : Prisma.JsonNull;
    const curriculo = await this.prisma.curriculo.update({ where: { id }, data });
    return this.curriculo(curriculo);
  }

  async registrarConsentimento(registro: ConsentimentoRegistro): Promise<ConsentimentoRegistro> {
    const criado = await this.prisma.consentimento.create({
      data: {
        id: registro.id,
        candidatoId: registro.candidatoId,
        tipo: registro.tipo,
        concedido: registro.concedido,
        versaoTermo: registro.versaoTermo,
        criadoEm: registro.criadoEm,
      },
    });
    return {
      id: criado.id,
      candidatoId: criado.candidatoId,
      tipo: criado.tipo,
      concedido: criado.concedido,
      versaoTermo: criado.versaoTermo,
      criadoEm: criado.criadoEm,
    };
  }

  async listarConsentimentos(candidatoId: string): Promise<ConsentimentoRegistro[]> {
    const itens = await this.prisma.consentimento.findMany({ where: { candidatoId }, orderBy: { criadoEm: 'asc' } });
    return itens.map((item) => ({
      id: item.id,
      candidatoId: item.candidatoId,
      tipo: item.tipo,
      concedido: item.concedido,
      versaoTermo: item.versaoTermo,
      criadoEm: item.criadoEm,
    }));
  }

  async registrarSolicitacaoLgpd(registro: SolicitacaoLgpdRegistro): Promise<void> {
    await this.prisma.solicitacaoLgpd.create({ data: registro });
  }

  async expurgarDadosCandidato(
    usuarioId: string,
    anon: { email: string; senhaHash: string; nome: string },
  ): Promise<{ arquivoKeys: string[] }> {
    return this.prisma.$transaction(async (tx) => {
      const candidato = await tx.candidato.findUnique({ where: { usuarioId } });
      if (!candidato) throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'candidato não encontrado');
      const curriculos = await tx.curriculo.findMany({ where: { candidatoId: candidato.id } });
      await tx.candidatoHabilidade.deleteMany({ where: { candidatoId: candidato.id } });
      await tx.consentimento.deleteMany({ where: { candidatoId: candidato.id } });
      await tx.curriculo.deleteMany({ where: { candidatoId: candidato.id } });
      await tx.candidato.update({
        where: { id: candidato.id },
        data: {
          nome: anon.nome,
          whatsapp: null,
          whatsappVerificado: false,
          linkedinUrl: null,
          perfil: {},
          visivelParaMatch: false,
        },
      });
      await tx.usuario.update({ where: { id: usuarioId }, data: { email: anon.email, senhaHash: anon.senhaHash } });
      await tx.refreshToken.updateMany({
        where: { usuarioId, revogadoEm: null },
        data: { revogadoEm: new Date() },
      });
      return { arquivoKeys: curriculos.map((item) => item.arquivoKey) };
    });
  }

  async registrarAuditoria(registro: AuditoriaRegistro, ctx: ContextoTenant): Promise<AuditoriaRegistro> {
    return this.comTenant(ctx, (tx) => tx.auditoriaAcesso.create({ data: registro }));
  }

  async listarAuditoria(ctx: ContextoTenant, empresaId?: string): Promise<AuditoriaRegistro[]> {
    return this.comTenant(ctx, (tx) =>
      tx.auditoriaAcesso.findMany({
        where: empresaId ? { empresaId } : undefined,
        orderBy: { criadoEm: 'desc' },
      }),
    );
  }

  async alterarAuditoria(): Promise<never> {
    throw new ErroAplicacao('AUDITORIA_APPEND_ONLY', 409, 'auditorias_acesso é append-only');
  }

  async salvarInstancia(instancia: InstanciaRegistro, ctx: ContextoTenant): Promise<InstanciaRegistro> {
    const data = { ...instancia, provedor: 'UAZAPI' as const };
    return this.comTenant(ctx, (tx) =>
      tx.instanciaWhatsapp.upsert({
        where: { empresaId: instancia.empresaId },
        create: data,
        update: data,
      }),
    );
  }

  async buscarInstanciaPorEmpresa(empresaId: string, ctx: ContextoTenant): Promise<InstanciaRegistro | null> {
    const instancia = await this.comTenant(ctx, (tx) => tx.instanciaWhatsapp.findUnique({ where: { empresaId } }));
    return instancia ? this.instancia(instancia) : null;
  }

  async listarInstancias(ctx: ContextoTenant): Promise<InstanciaRegistro[]> {
    const itens = await this.comTenant(ctx, (tx) => tx.instanciaWhatsapp.findMany());
    return itens.map((item) => this.instancia(item));
  }

  pausarVagasPublicadas(empresaId: string, quando: Date, ctx: ContextoTenant): Promise<number> {
    return this.vagasStore.pausarPublicadas(empresaId, quando, ctx);
  }

  garantirHabilidade(nome: string, categoria?: string) {
    return this.vagasStore.garantirHabilidade(nome, categoria);
  }

  buscarHabilidade(id: string) {
    return this.vagasStore.buscarHabilidade(id);
  }

  listarHabilidades() {
    return this.vagasStore.listarHabilidades();
  }

  criarVaga(dados: Parameters<VagasPrisma['criarVaga']>[0], ctx: ContextoTenant) {
    return this.vagasStore.criarVaga(dados, ctx);
  }

  atualizarVaga(id: string, patch: Parameters<VagasPrisma['atualizarVaga']>[1], ctx: ContextoTenant) {
    return this.vagasStore.atualizarVaga(id, patch, ctx);
  }

  buscarVaga(id: string, ctx: ContextoTenant) {
    return this.vagasStore.buscarVaga(id, ctx);
  }

  listarVagasEmpresa(empresaId: string, ctx: ContextoTenant) {
    return this.vagasStore.listarVagasEmpresa(empresaId, ctx);
  }

  listarVagasPublicas(filtro: Parameters<VagasPrisma['listarVagasPublicas']>[0]) {
    return this.vagasStore.listarVagasPublicas(filtro);
  }

  substituirHabilidades(vagaId: string, itens: Parameters<VagasPrisma['substituirHabilidades']>[1], ctx: ContextoTenant) {
    return this.vagasStore.substituirHabilidades(vagaId, itens, ctx);
  }

  listarHabilidadesVaga(vagaId: string, ctx: ContextoTenant) {
    return this.vagasStore.listarHabilidadesVaga(vagaId, ctx);
  }

  salvarProcesso(dados: Parameters<VagasPrisma['salvarProcesso']>[0], ctx: ContextoTenant) {
    return this.vagasStore.salvarProcesso(dados, ctx);
  }

  buscarProcessoPorVaga(vagaId: string, ctx: ContextoTenant) {
    return this.vagasStore.buscarProcessoPorVaga(vagaId, ctx);
  }

  buscarProcessoPorId(id: string, ctx: ContextoTenant) {
    return this.vagasStore.buscarProcessoPorId(id, ctx);
  }

  salvarEtapa(dados: Parameters<VagasPrisma['salvarEtapa']>[0], ctx: ContextoTenant) {
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

  criarPergunta(dados: Parameters<VagasPrisma['criarPergunta']>[0], ctx: ContextoTenant) {
    return this.vagasStore.criarPergunta(dados, ctx);
  }

  atualizarPergunta(id: string, patch: Parameters<VagasPrisma['atualizarPergunta']>[1], ctx: ContextoTenant) {
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

  vincularPergunta(dados: Parameters<VagasPrisma['vincularPergunta']>[0], ctx: ContextoTenant) {
    return this.vagasStore.vincularPergunta(dados, ctx);
  }

  listarVinculosEtapa(etapaId: string, ctx: ContextoTenant) {
    return this.vagasStore.listarVinculosEtapa(etapaId, ctx);
  }

  registrarEventoVaga(evento: Parameters<VagasPrisma['registrarEventoVaga']>[0], ctx: ContextoTenant) {
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

  async buscarResposta(id: string, ctx: ContextoTenant): Promise<RespostaSensivel | null> {
    const resposta = await this.comTenant(ctx, (tx) =>
      tx.resposta.findUnique({ where: { id }, select: { id: true, empresaId: true, audioUrl: true, transcricao: true } }),
    );
    return resposta;
  }

  async guardarResposta(): Promise<void> {
    throw new ErroAplicacao('NAO_SUPORTADO', 500, 'gravação de resposta de teste só existe no repositório em memória');
  }

  private usuario(usuario: {
    id: string;
    email: string;
    senhaHash: string;
    papeisGlobais: UsuarioRegistro['papeisGlobais'];
    mfaAtivo: boolean;
    mfaSecretCifrado: string | null;
    visaoPreferida: UsuarioRegistro['visaoPreferida'];
    emailConfirmadoEm: Date | null;
  }): UsuarioRegistro {
    return {
      id: usuario.id,
      email: usuario.email,
      senhaHash: usuario.senhaHash,
      papeisGlobais: usuario.papeisGlobais,
      mfaAtivo: usuario.mfaAtivo,
      mfaSecretCifrado: usuario.mfaSecretCifrado,
      visaoPreferida: usuario.visaoPreferida,
      emailConfirmadoEm: usuario.emailConfirmadoEm,
    };
  }

  private empresa(empresa: {
    id: string;
    razaoSocial: string;
    nomeFantasia: string;
    cnpj: string;
    dominio: string;
    responsavelNome: string;
    responsavelEmail: string;
    responsavelCargo: string | null;
    telefone: string | null;
    endereco: Prisma.JsonValue | null;
    statusVerificacao: EmpresaRegistro['statusVerificacao'];
    verificadaEm: Date | null;
    configuracoes: Prisma.JsonValue;
  }): EmpresaRegistro {
    return {
      id: empresa.id,
      razaoSocial: empresa.razaoSocial,
      nomeFantasia: empresa.nomeFantasia,
      cnpj: empresa.cnpj,
      dominio: empresa.dominio,
      responsavelNome: empresa.responsavelNome,
      responsavelEmail: empresa.responsavelEmail,
      responsavelCargo: empresa.responsavelCargo,
      telefone: empresa.telefone,
      endereco: objetoOuNulo(empresa.endereco),
      statusVerificacao: empresa.statusVerificacao,
      verificadaEm: empresa.verificadaEm,
      configuracoes: objeto(empresa.configuracoes),
    };
  }

  private perfil(candidato: {
    id: string;
    usuarioId: string;
    nome: string;
    whatsapp: string | null;
    whatsappVerificado: boolean;
    linkedinUrl: string | null;
    perfil: Prisma.JsonValue;
    visivelParaMatch: boolean;
  }): PerfilCandidato {
    return {
      id: candidato.id,
      usuarioId: candidato.usuarioId,
      nome: candidato.nome,
      whatsapp: candidato.whatsapp,
      whatsappVerificado: candidato.whatsappVerificado,
      linkedinUrl: candidato.linkedinUrl,
      perfil: objeto(candidato.perfil),
      visivelParaMatch: candidato.visivelParaMatch,
    };
  }

  private curriculo(curriculo: {
    id: string;
    candidatoId: string;
    arquivoKey: string;
    mimeType: string | null;
    tamanhoBytes: number | null;
    antivirusStatus: CurriculoRegistro['antivirusStatus'];
    metodoExtracao: CurriculoRegistro['metodoExtracao'];
    statusProcessamento: CurriculoRegistro['statusProcessamento'];
    confiancaOcr: number | null;
    textoExtraido: string | null;
    dadosExtraidos: Prisma.JsonValue | null;
    confirmadoEm: Date | null;
    aplicadoAoPerfil: boolean;
    paginas: Prisma.JsonValue | null;
    criadoEm: Date;
  }): CurriculoRegistro {
    return {
      id: curriculo.id,
      candidatoId: curriculo.candidatoId,
      arquivoKey: curriculo.arquivoKey,
      mimeType: curriculo.mimeType,
      tamanhoBytes: curriculo.tamanhoBytes,
      antivirusStatus: curriculo.antivirusStatus,
      metodoExtracao: curriculo.metodoExtracao,
      statusProcessamento: curriculo.statusProcessamento,
      confiancaOcr: curriculo.confiancaOcr,
      textoExtraido: curriculo.textoExtraido,
      dadosExtraidos: objetoOuNulo(curriculo.dadosExtraidos),
      confirmadoEm: curriculo.confirmadoEm,
      aplicadoAoPerfil: curriculo.aplicadoAoPerfil,
      paginas: curriculo.paginas,
      criadoEm: curriculo.criadoEm,
    };
  }

  private instancia(instancia: InstanciaRegistro): InstanciaRegistro {
    return {
      id: instancia.id,
      empresaId: instancia.empresaId,
      instanciaIdProvedorCifrado: instancia.instanciaIdProvedorCifrado,
      tokenCifrado: instancia.tokenCifrado,
      numero: instancia.numero,
      status: instancia.status,
      ultimaConexaoEm: instancia.ultimaConexaoEm,
      desconectadaEm: instancia.desconectadaEm,
    };
  }
}
