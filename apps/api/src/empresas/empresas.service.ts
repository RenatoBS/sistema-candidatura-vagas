import { randomBytes, randomUUID } from 'node:crypto';

import {
  cnpjDigitosValidos,
  decidirAposChecagens,
  emailConfirmaDominio,
  normalizarDominio,
  podePublicarVaga,
  razoesCompativeis,
  registroTxtEsperado,
  somenteDigitosCnpj,
  transicionarEmpresa,
  txtConfirmaDominio,
  type ResultadoChecagem,
  type StatusEmpresa,
} from '@scv/domain';
import type { EmailProvider, FonteCnpjProvider } from '@scv/providers';

import { AuditoriaService } from '../auditoria/auditoria.service';
import type { Relogio } from '../auth/auth.service';
import { codigoNumerico, hashSegredo } from '../auth/segredos';
import type { ConfiguracaoApp } from '../configuracao';
import type { ResolvedorDns } from '../dns';
import { ErroAplicacao } from '../erros';
import type { FilaCnpj } from '../fila/fila-cnpj';
import type {
  ContextoTenant,
  EmpresaRegistro,
  Repositorio,
  TipoVerificacao,
  VerificacaoRegistro,
} from '../repositorio/tipos';
import { ctxDe, exigir, montarAtor, papelAuditoria, type SessaoRequest } from '../sessao';

export interface CadastroEmpresaEntrada {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  dominio: string;
  responsavelNome: string;
  responsavelEmail: string;
  responsavelCargo?: string;
  telefone?: string;
  endereco?: Record<string, unknown>;
}

export class EmpresasService {
  constructor(
    private readonly repo: Repositorio,
    private readonly email: EmailProvider,
    private readonly fonteCnpj: FonteCnpjProvider,
    private readonly fila: FilaCnpj,
    private readonly dns: ResolvedorDns,
    private readonly auditoria: AuditoriaService,
    private readonly config: ConfiguracaoApp,
    private readonly relogio: Relogio,
  ) {}

  async cadastrar(sessao: SessaoRequest, entrada: CadastroEmpresaEntrada) {
    exigir(sessao, 'auto_cadastrar_empresa');
    if (!sessao.usuario.emailConfirmadoEm) {
      throw new ErroAplicacao('EMAIL_NAO_CONFIRMADO', 403, 'confirme o e-mail da conta antes do cadastro');
    }
    if (!cnpjDigitosValidos(entrada.cnpj)) {
      throw new ErroAplicacao('CNPJ_INVALIDO', 400, 'CNPJ com dígitos inválidos');
    }
    const cnpj = somenteDigitosCnpj(entrada.cnpj);
    if (await this.repo.cnpjExiste(cnpj)) {
      throw new ErroAplicacao('CNPJ_EM_USO', 409, 'CNPJ já cadastrado');
    }
    const dominio = normalizarDominio(entrada.dominio);
    const id = randomUUID();
    const dnsTxtToken = randomBytes(16).toString('hex');
    const empresa: EmpresaRegistro = {
      id,
      razaoSocial: entrada.razaoSocial.trim(),
      nomeFantasia: entrada.nomeFantasia.trim(),
      cnpj,
      dominio,
      responsavelNome: entrada.responsavelNome.trim(),
      responsavelEmail: entrada.responsavelEmail.trim().toLowerCase(),
      responsavelCargo: entrada.responsavelCargo?.trim() ?? null,
      telefone: entrada.telefone?.trim() ?? null,
      endereco: entrada.endereco ?? null,
      statusVerificacao: 'PENDENTE',
      verificadaEm: null,
      configuracoes: { dnsTxtToken, exigeRevisaoManual: false },
    };
    await this.repo.criarEmpresaComResponsavel(empresa, {
      id: randomUUID(),
      usuarioId: sessao.usuario.id,
      empresaId: id,
      papeis: ['ADMIN_EMPRESA'],
      status: 'ATIVO',
    });
    await this.enviarCodigoEmail(empresa);
    return this.resumo(empresa);
  }

  async confirmarEmail(sessao: SessaoRequest, empresaId: string, codigo: string) {
    await this.exigirDono(sessao, empresaId);
    const registro = await this.repo.buscarTokenPorHash(hashSegredo(codigo), { empresaId });
    const agora = this.relogio.agora();
    if (
      !registro ||
      registro.tipo !== 'VERIFICACAO_EMAIL_EMPRESA' ||
      registro.empresaId !== empresaId ||
      registro.usadoEm ||
      registro.expiraEm <= agora
    ) {
      throw new ErroAplicacao('CODIGO_INVALIDO', 400, 'código inválido');
    }
    await this.repo.marcarTokenUsado(registro.id, agora, { empresaId });
    const ctx = { empresaId };
    await this.repo.registrarVerificacao(this.verificacao(empresaId, 'EMAIL', 'OK', {}), ctx);
    const empresa = await this.obter(empresaId, ctx);
    if (emailConfirmaDominio(empresa.responsavelEmail, empresa.dominio)) {
      await this.repo.registrarVerificacao(this.verificacao(empresaId, 'DOMINIO', 'OK', { via: 'email' }), ctx);
    }
    await this.fila.enfileirar(empresaId);
    return this.reconciliar(empresaId);
  }

  async confirmarDominio(sessao: SessaoRequest, empresaId: string) {
    await this.exigirDono(sessao, empresaId);
    const ctx = { empresaId };
    const empresa = await this.obter(empresaId, ctx);
    const token = String(empresa.configuracoes.dnsTxtToken ?? '');
    const registros = await this.dns.txt(empresa.dominio);
    const ok = txtConfirmaDominio(registros, token);
    await this.repo.registrarVerificacao(
      this.verificacao(empresaId, 'DOMINIO', ok ? 'OK' : 'FALHA', { via: 'dns' }),
      ctx,
    );
    return this.reconciliar(empresaId);
  }

  async processarCnpj(empresaId: string) {
    const ctx = { empresaId };
    const empresa = await this.obter(empresaId, ctx);
    const fonte = await this.fonteCnpj.consultar(empresa.cnpj);
    let resultado: ResultadoChecagem = 'FALHA';
    if (fonte.indisponivel) resultado = 'INDISPONIVEL';
    else if (fonte.situacaoAtiva && razoesCompativeis(empresa.razaoSocial, fonte.razaoSocial)) {
      resultado = 'OK';
    }
    await this.repo.registrarVerificacao(
      this.verificacao(empresaId, 'CNPJ', resultado, {
        razaoOficial: fonte.razaoSocial,
        situacaoAtiva: fonte.situacaoAtiva,
        indisponivel: fonte.indisponivel,
      }),
      ctx,
    );
    return this.reconciliar(empresaId);
  }

  async publicar(sessao: SessaoRequest, empresaId: string) {
    const alinhada = await this.alinharEmpresa(sessao, empresaId);
    exigir(alinhada, 'publicar_vaga');
    const status = alinhada.empresa?.statusVerificacao ?? 'PENDENTE';
    if (!podePublicarVaga(status, false) && alinhada.visao !== 'ADMIN') {
      throw new ErroAplicacao('EMPRESA_NAO_VERIFICADA', 403, 'empresa não verificada não publica vaga');
    }
    if (status !== 'VERIFICADA' && alinhada.visao !== 'ADMIN') {
      throw new ErroAplicacao('EMPRESA_NAO_VERIFICADA', 403, 'empresa não verificada não publica vaga');
    }
    return { permitido: true, status };
  }

  async reenviar(sessao: SessaoRequest, empresaId: string) {
    const alinhada = await this.alinharEmpresa(sessao, empresaId);
    exigir(alinhada, 'configurar_tenant');
    const empresa = alinhada.empresa;
    if (!empresa) throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'empresa não encontrada');
    const proximo = transicionarEmpresa(empresa.statusVerificacao, 'reenviar');
    if (!proximo) throw new ErroAplicacao('TRANSICAO_INVALIDA', 409, 'reenvio não permitido neste estado');
    const ctx = ctxDe(alinhada, empresaId);
    await this.repo.atualizarEmpresa(
      empresaId,
      {
        statusVerificacao: proximo,
        configuracoes: { ...empresa.configuracoes, exigeRevisaoManual: false },
      },
      ctx,
    );
    await this.enviarCodigoEmail({ ...empresa, statusVerificacao: proximo });
    return this.resumo({ ...empresa, statusVerificacao: proximo });
  }

  async listarFila(sessao: SessaoRequest) {
    exigir(sessao, 'aprovar_verificacao_empresa');
    const empresas = await this.repo.listarEmpresas({ isAdmin: true });
    return empresas
      .filter((empresa) => empresa.statusVerificacao === 'PENDENTE' && empresa.configuracoes.exigeRevisaoManual === true)
      .map((empresa) => this.resumo(empresa));
  }

  async listar(sessao: SessaoRequest) {
    exigir(sessao, 'aprovar_verificacao_empresa');
    const empresas = await this.repo.listarEmpresas({ isAdmin: true });
    return empresas.map((empresa) => this.resumo(empresa));
  }

  async moderar(
    sessao: SessaoRequest,
    empresaId: string,
    acao: 'aprovar' | 'rejeitar' | 'suspender' | 'reativar',
    motivo?: string,
  ) {
    exigir(sessao, 'aprovar_verificacao_empresa');
    if ((acao === 'rejeitar' || acao === 'suspender') && !motivo) {
      throw new ErroAplicacao('MOTIVO_OBRIGATORIO', 400, 'motivo obrigatório');
    }
    const ctx: ContextoTenant = { isAdmin: true, empresaId };
    const empresa = await this.obter(empresaId, ctx);
    const proximo = transicionarEmpresa(empresa.statusVerificacao, acao);
    if (!proximo) throw new ErroAplicacao('TRANSICAO_INVALIDA', 409, 'transição inválida');
    const verificadaEm = proximo === 'VERIFICADA' ? this.relogio.agora() : empresa.verificadaEm;
    const atualizada = await this.repo.atualizarEmpresa(
      empresaId,
      {
        statusVerificacao: proximo,
        verificadaEm,
        configuracoes: { ...empresa.configuracoes, exigeRevisaoManual: false },
      },
      ctx,
    );
    await this.repo.registrarVerificacao(
      this.verificacao(empresaId, 'REVISAO_MANUAL', acao.toUpperCase(), {}, sessao.usuario.id, motivo ?? null),
      ctx,
    );
    if (acao === 'suspender') {
      await this.repo.pausarVagasPublicadas(empresaId, this.relogio.agora(), ctx);
    }
    await this.auditoria.registrar(
      {
        usuarioId: sessao.usuario.id,
        empresaId,
        papel: papelAuditoria(sessao),
        acao: `EMPRESA_${acao.toUpperCase()}`,
        recursoTipo: 'EMPRESA',
        recursoId: empresaId,
        motivo: motivo ?? null,
      },
      ctx,
    );
    return this.resumo(atualizada);
  }

  async obterParaMembro(sessao: SessaoRequest, empresaId: string) {
    const alinhada = await this.alinharEmpresa(sessao, empresaId);
    if (alinhada.visao === 'ADMIN') exigir(alinhada, 'aprovar_verificacao_empresa');
    else exigir(alinhada, 'ver_status_whatsapp');
    const empresa = alinhada.empresa ?? (await this.obter(empresaId, ctxDe(alinhada, empresaId)));
    return this.resumo(empresa);
  }

  private async reconciliar(empresaId: string) {
    const ctx = { empresaId };
    const empresa = await this.obter(empresaId, ctx);
    if (empresa.statusVerificacao !== 'PENDENTE') return this.resumo(empresa);
    const verificacoes = await this.repo.listarVerificacoes(empresaId, ctx);
    const ultima = (tipo: TipoVerificacao) => [...verificacoes].reverse().find((item) => item.tipo === tipo);
    const como = (item: VerificacaoRegistro | undefined): ResultadoChecagem | null => {
      if (!item) return null;
      if (item.resultado === 'OK' || item.resultado === 'FALHA' || item.resultado === 'INDISPONIVEL') {
        return item.resultado;
      }
      return null;
    };
    const decisao = decidirAposChecagens(
      {
        email: como(ultima('EMAIL')),
        dominio: como(ultima('DOMINIO')),
        cnpj: como(ultima('CNPJ')),
      },
      this.config.politicaRevisao,
    );
    const status: StatusEmpresa = decisao.status;
    const atualizada = await this.repo.atualizarEmpresa(
      empresaId,
      {
        statusVerificacao: status,
        verificadaEm: status === 'VERIFICADA' ? this.relogio.agora() : null,
        configuracoes: { ...empresa.configuracoes, exigeRevisaoManual: decisao.exigeRevisaoManual },
      },
      ctx,
    );
    return this.resumo(atualizada);
  }

  private async exigirDono(sessao: SessaoRequest, empresaId: string): Promise<SessaoRequest> {
    const alinhada = await this.alinharEmpresa(sessao, empresaId);
    exigir(alinhada, 'configurar_tenant');
    return alinhada;
  }

  private async alinharEmpresa(sessao: SessaoRequest, empresaId: string): Promise<SessaoRequest> {
    const ctx = ctxDe({ ...sessao, empresaId }, empresaId);
    const empresa = await this.repo.buscarEmpresaPorId(empresaId, ctx);
    const membro = await this.repo.buscarMembro(sessao.usuario.id, empresaId, ctx);
    const base = { ...sessao, empresaId, empresa, membro };
    return { ...base, ator: montarAtor(base) };
  }

  private async obter(empresaId: string, ctx: ContextoTenant): Promise<EmpresaRegistro> {
    const empresa = await this.repo.buscarEmpresaPorId(empresaId, ctx);
    if (!empresa) throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'empresa não encontrada');
    return empresa;
  }

  private async enviarCodigoEmail(empresa: EmpresaRegistro): Promise<void> {
    const codigo = codigoNumerico();
    await this.repo.salvarToken(
      {
        id: randomUUID(),
        usuarioId: null,
        empresaId: empresa.id,
        email: empresa.responsavelEmail,
        tipo: 'VERIFICACAO_EMAIL_EMPRESA',
        tokenHash: hashSegredo(codigo),
        expiraEm: new Date(this.relogio.agora().getTime() + 30 * 60 * 1000),
        usadoEm: null,
      },
      { empresaId: empresa.id },
    );
    await this.email.enviar({
      para: empresa.responsavelEmail,
      assunto: 'Confirme o e-mail da empresa',
      texto: `codigo:${codigo}`,
    });
  }

  private verificacao(
    empresaId: string,
    tipo: TipoVerificacao,
    resultado: string,
    detalhes: Record<string, unknown>,
    revisorAdminId: string | null = null,
    motivo: string | null = null,
  ): VerificacaoRegistro {
    return {
      id: randomUUID(),
      empresaId,
      tipo,
      resultado,
      detalhes,
      revisorAdminId,
      motivo,
      criadoEm: this.relogio.agora(),
    };
  }

  private resumo(empresa: EmpresaRegistro) {
    return {
      id: empresa.id,
      razaoSocial: empresa.razaoSocial,
      nomeFantasia: empresa.nomeFantasia,
      cnpj: empresa.cnpj,
      dominio: empresa.dominio,
      responsavelNome: empresa.responsavelNome,
      responsavelEmail: empresa.responsavelEmail,
      statusVerificacao: empresa.statusVerificacao,
      exigeRevisaoManual: empresa.configuracoes.exigeRevisaoManual === true,
      registroDns: registroTxtEsperado(String(empresa.configuracoes.dnsTxtToken ?? '')),
    };
  }
}
