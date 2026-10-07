import { randomUUID } from 'node:crypto';

import type { PapelGlobal, Visao } from '@scv/domain';
import { senhaAtendePolitica } from '@scv/domain';
import type { EmailProvider } from '@scv/providers';
import bcrypt from 'bcryptjs';

import type { ConfiguracaoApp } from '../configuracao';
import { ErroAplicacao } from '../erros';
import type { Repositorio, UsuarioRegistro, VinculoUsuario } from '../repositorio/tipos';
import { assinarJwt, lerJwt, type AccessPayload, type ReauthPayload } from './jwt';
import { codigoNumerico, hashSegredo, segredoUrl } from './segredos';

export interface Relogio {
  agora(): Date;
}

export const relogioSistema: Relogio = { agora: () => new Date() };

export interface SessaoEmitida {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface PerfilMe {
  id: string;
  email: string;
  emailConfirmado: boolean;
  papeisGlobais: PapelGlobal[];
  mfaAtivo: boolean;
  mfaVerificado: boolean;
  visao: Visao;
  empresaAtivaId: string | null;
  ehCandidato: boolean;
  empresas: VinculoUsuario[];
  visoesDisponiveis: Visao[];
}

function escolherEmpresaAtiva(preferida: string | null, ativas: VinculoUsuario[]): string | null {
  if (preferida && ativas.some((item) => item.empresaId === preferida)) return preferida;
  return ativas[0]?.empresaId ?? null;
}

export class AuthService {
  constructor(
    private readonly repo: Repositorio,
    private readonly email: EmailProvider,
    private readonly config: ConfiguracaoApp,
    private readonly relogio: Relogio,
  ) {}

  async cadastrar(entrada: { email: string; senha: string }): Promise<{ id: string }> {
    const email = entrada.email.trim().toLowerCase();
    if (!senhaAtendePolitica(entrada.senha)) {
      throw new ErroAplicacao('SENHA_FRACA', 400, 'a senha precisa de letra e número');
    }
    const senhaHash = await bcrypt.hash(entrada.senha, this.config.bcryptRounds);
    const usuario = await this.repo.criarUsuario({
      id: randomUUID(),
      email,
      senhaHash,
      papeisGlobais: [],
      mfaAtivo: false,
      mfaSecretCifrado: null,
      visaoPreferida: 'CANDIDATO',
      emailConfirmadoEm: null,
    });
    await this.enviarConfirmacao(usuario);
    return { id: usuario.id };
  }

  async login(entrada: { email: string; senha: string }): Promise<SessaoEmitida & { mfaObrigatorio: boolean }> {
    const email = entrada.email.trim().toLowerCase();
    const usuario = await this.repo.buscarUsuarioPorEmail(email);
    const ok = usuario ? await bcrypt.compare(entrada.senha, usuario.senhaHash) : false;
    if (!usuario || !ok) {
      throw new ErroAplicacao('CREDENCIAIS_INVALIDAS', 401, 'credenciais inválidas');
    }
    const empresaId = await this.empresaAtivaDe(usuario, usuario.visaoPreferida);
    const sessao = await this.emitirSessao(usuario, false, usuario.visaoPreferida, empresaId);
    return { ...sessao, mfaObrigatorio: this.ehAdmin(usuario) };
  }

  async refresh(refreshToken: string): Promise<SessaoEmitida> {
    const atual = await this.repo.buscarRefreshPorHash(hashSegredo(refreshToken));
    const agora = this.relogio.agora();
    if (!atual || atual.revogadoEm || atual.expiraEm <= agora) {
      throw new ErroAplicacao('REFRESH_INVALIDO', 401, 'sessão inválida');
    }
    if (atual.substituidoEm) {
      await this.repo.revogarFamilia(atual.familiaId, agora);
      throw new ErroAplicacao('REFRESH_REUTILIZADO', 401, 'sessão revogada');
    }
    const usuario = await this.repo.buscarUsuarioPorId(atual.usuarioId);
    if (!usuario) throw new ErroAplicacao('REFRESH_INVALIDO', 401, 'sessão inválida');
    await this.repo.marcarRefreshSubstituido(atual.id, agora);
    const empresaId = await this.empresaAtivaDe(usuario, usuario.visaoPreferida);
    return this.emitirSessao(usuario, atual.mfaVerificado, usuario.visaoPreferida, empresaId, atual.familiaId);
  }

  async logout(refreshToken: string): Promise<void> {
    const atual = await this.repo.buscarRefreshPorHash(hashSegredo(refreshToken));
    if (!atual) return;
    await this.repo.revogarFamilia(atual.familiaId, this.relogio.agora());
  }

  async recuperarSenha(emailInformado: string): Promise<{ ok: true }> {
    const usuario = await this.repo.buscarUsuarioPorEmail(emailInformado.trim().toLowerCase());
    if (usuario) {
      const token = codigoNumerico();
      const expira = new Date(this.relogio.agora().getTime() + 30 * 60 * 1000);
      await this.repo.salvarToken({
        id: randomUUID(),
        usuarioId: usuario.id,
        empresaId: null,
        email: usuario.email,
        tipo: 'RECUPERACAO_SENHA',
        tokenHash: hashSegredo(token),
        expiraEm: expira,
        usadoEm: null,
      });
      await this.email.enviar({
        para: usuario.email,
        assunto: 'Recuperação de senha',
        texto: `codigo:${token}`,
      });
    }
    return { ok: true };
  }

  async redefinirSenha(token: string, senha: string): Promise<void> {
    if (!senhaAtendePolitica(senha)) {
      throw new ErroAplicacao('SENHA_FRACA', 400, 'a senha precisa de letra e número');
    }
    const registro = await this.consumirToken(token, 'RECUPERACAO_SENHA');
    if (!registro.usuarioId) throw new ErroAplicacao('TOKEN_INVALIDO', 400, 'token inválido');
    const senhaHash = await bcrypt.hash(senha, this.config.bcryptRounds);
    await this.repo.atualizarUsuario(registro.usuarioId, { senhaHash });
    await this.repo.revogarRefreshDoUsuario(registro.usuarioId, this.relogio.agora());
  }

  async confirmarEmail(token: string): Promise<void> {
    const registro = await this.consumirToken(token, 'CONFIRMACAO_EMAIL');
    if (!registro.usuarioId) throw new ErroAplicacao('TOKEN_INVALIDO', 400, 'token inválido');
    await this.repo.atualizarUsuario(registro.usuarioId, { emailConfirmadoEm: this.relogio.agora() });
  }

  async reenviarConfirmacao(usuarioId: string): Promise<void> {
    const usuario = await this.repo.buscarUsuarioPorId(usuarioId);
    if (!usuario) throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'usuário não encontrado');
    if (usuario.emailConfirmadoEm) return;
    await this.enviarConfirmacao(usuario);
  }

  async me(usuarioId: string, mfaVerificado: boolean, visao: Visao, empresaAtivaId: string | null): Promise<PerfilMe> {
    const usuario = await this.exigirUsuario(usuarioId);
    const empresas = await this.repo.vinculosDoUsuario(usuarioId);
    const candidato = await this.repo.buscarCandidatoPorUsuario(usuarioId);
    return {
      id: usuario.id,
      email: usuario.email,
      emailConfirmado: Boolean(usuario.emailConfirmadoEm),
      papeisGlobais: usuario.papeisGlobais,
      mfaAtivo: usuario.mfaAtivo,
      mfaVerificado,
      visao,
      empresaAtivaId,
      ehCandidato: Boolean(candidato),
      empresas,
      visoesDisponiveis: this.visoesDe(usuario, Boolean(candidato), empresas),
    };
  }

  async alterarVisao(
    usuarioId: string,
    mfaVerificado: boolean,
    visao: Visao,
    empresaId?: string,
  ): Promise<SessaoEmitida & { perfil: PerfilMe }> {
    const usuario = await this.exigirUsuario(usuarioId);
    const candidato = await this.repo.buscarCandidatoPorUsuario(usuarioId);
    const empresas = await this.repo.vinculosDoUsuario(usuarioId);
    const disponiveis = this.visoesDe(usuario, Boolean(candidato), empresas);
    if (!disponiveis.includes(visao)) {
      throw new ErroAplicacao('VISAO_INDISPONIVEL', 403, 'visão indisponível para esta conta');
    }
    let empresaAtiva: string | null = null;
    if (visao === 'EMPRESA') {
      const ativas = empresas.filter((item) => item.status === 'ATIVO');
      const escolhida = empresaId ?? escolherEmpresaAtiva(usuario.empresaAtivaId ?? null, ativas);
      if (!escolhida || !ativas.some((item) => item.empresaId === escolhida)) {
        throw new ErroAplicacao('EMPRESA_INVALIDA', 400, 'empresa ativa inválida');
      }
      empresaAtiva = escolhida;
    }
    if (visao === 'ADMIN' && (!usuario.mfaAtivo || !mfaVerificado)) {
      throw new ErroAplicacao('MFA_OBRIGATORIO', 403, 'admin precisa concluir o MFA');
    }
    await this.repo.atualizarUsuario(usuarioId, {
      visaoPreferida: visao,
      ...(empresaAtiva ? { empresaAtivaId: empresaAtiva } : {}),
    });
    const sessao = await this.emitirSessao(
      { ...usuario, visaoPreferida: visao },
      mfaVerificado,
      visao,
      empresaAtiva,
    );
    const perfil = await this.me(usuarioId, mfaVerificado, visao, empresaAtiva);
    return { ...sessao, perfil };
  }

  async tornarCandidato(usuarioId: string, nome: string, mfaVerificado: boolean): Promise<SessaoEmitida> {
    const usuario = await this.exigirUsuario(usuarioId);
    const existente = await this.repo.buscarCandidatoPorUsuario(usuarioId);
    if (!existente) {
      await this.repo.criarCandidato({ id: randomUUID(), usuarioId, nome: nome.trim() });
    }
    return this.emitirSessao(usuario, mfaVerificado, 'CANDIDATO', null);
  }

  async emitirSessao(
    usuario: UsuarioRegistro,
    mfaVerificado: boolean,
    visao: Visao,
    empresaId: string | null,
    familiaId?: string,
  ): Promise<SessaoEmitida> {
    const agora = this.relogio.agora();
    const admin = this.ehAdmin(usuario);
    const accessTtl = admin ? this.config.accessAdminTtlSegundos : this.config.accessTtlSegundos;
    const refreshTtl = admin ? this.config.refreshAdminTtlSegundos : this.config.refreshTtlSegundos;
    const refreshBruto = segredoUrl();
    const familia = familiaId ?? randomUUID();
    await this.repo.salvarRefresh({
      id: randomUUID(),
      usuarioId: usuario.id,
      familiaId: familia,
      tokenHash: hashSegredo(refreshBruto),
      mfaVerificado,
      expiraEm: new Date(agora.getTime() + refreshTtl * 1000),
      revogadoEm: null,
      substituidoEm: null,
    });
    const accessToken = assinarJwt(
      {
        sub: usuario.id,
        email: usuario.email,
        visao,
        empresaId,
        mfaVerificado,
        tipo: 'access',
      },
      this.config.jwtSecret,
      accessTtl,
      agora.getTime(),
    );
    return { accessToken, refreshToken: refreshBruto, expiresIn: accessTtl };
  }

  lerAccess(token: string): AccessPayload {
    try {
      const payload = lerJwt<AccessPayload>(token, this.config.jwtSecret, this.relogio.agora().getTime());
      if (payload.tipo !== 'access') throw new Error('tipo');
      return payload;
    } catch {
      throw new ErroAplicacao('NAO_AUTENTICADO', 401, 'sessão inválida');
    }
  }

  emitirReauth(usuarioId: string): string {
    return assinarJwt(
      { sub: usuarioId, tipo: 'reauth' },
      this.config.jwtSecret,
      this.config.reauthTtlSegundos,
      this.relogio.agora().getTime(),
    );
  }

  lerReauth(token: string | undefined, usuarioId: string): void {
    if (!token) throw new ErroAplicacao('REAUTH_OBRIGATORIA', 401, 'reautenticação obrigatória');
    try {
      const payload = lerJwt<ReauthPayload>(token, this.config.jwtSecret, this.relogio.agora().getTime());
      if (payload.tipo !== 'reauth' || payload.sub !== usuarioId) throw new Error('reauth');
    } catch (erro) {
      if (erro instanceof ErroAplicacao) throw erro;
      throw new ErroAplicacao('REAUTH_OBRIGATORIA', 401, 'reautenticação obrigatória');
    }
  }

  async conferirSenha(usuarioId: string, senha: string): Promise<void> {
    const usuario = await this.exigirUsuario(usuarioId);
    const ok = await bcrypt.compare(senha, usuario.senhaHash);
    if (!ok) throw new ErroAplicacao('CREDENCIAIS_INVALIDAS', 401, 'credenciais inválidas');
  }

  private async enviarConfirmacao(usuario: UsuarioRegistro): Promise<void> {
    const codigo = codigoNumerico();
    await this.repo.salvarToken({
      id: randomUUID(),
      usuarioId: usuario.id,
      empresaId: null,
      email: usuario.email,
      tipo: 'CONFIRMACAO_EMAIL',
      tokenHash: hashSegredo(codigo),
      expiraEm: new Date(this.relogio.agora().getTime() + 24 * 60 * 60 * 1000),
      usadoEm: null,
    });
    await this.email.enviar({
      para: usuario.email,
      assunto: 'Confirme seu e-mail',
      texto: `codigo:${codigo}`,
    });
  }

  private async consumirToken(token: string, tipo: 'CONFIRMACAO_EMAIL' | 'RECUPERACAO_SENHA') {
    const registro = await this.repo.buscarTokenPorHash(hashSegredo(token));
    const agora = this.relogio.agora();
    if (!registro || registro.tipo !== tipo || registro.usadoEm || registro.expiraEm <= agora) {
      throw new ErroAplicacao('TOKEN_INVALIDO', 400, 'token inválido');
    }
    await this.repo.marcarTokenUsado(registro.id, agora);
    return registro;
  }

  /** Empresa da sessão: a última escolhida (se ainda ativa) ou a primeira vinculada; null fora da visão EMPRESA. */
  private async empresaAtivaDe(usuario: UsuarioRegistro, visao: Visao): Promise<string | null> {
    if (visao !== 'EMPRESA') return null;
    const vinculos = await this.repo.vinculosDoUsuario(usuario.id);
    return escolherEmpresaAtiva(
      usuario.empresaAtivaId ?? null,
      vinculos.filter((item) => item.status === 'ATIVO'),
    );
  }

  private async exigirUsuario(id: string): Promise<UsuarioRegistro> {
    const usuario = await this.repo.buscarUsuarioPorId(id);
    if (!usuario) throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'usuário não encontrado');
    return usuario;
  }

  private ehAdmin(usuario: UsuarioRegistro): boolean {
    return usuario.papeisGlobais.includes('ADMIN_PLATAFORMA');
  }

  private visoesDe(usuario: UsuarioRegistro, ehCandidato: boolean, empresas: VinculoUsuario[]): Visao[] {
    const visoes: Visao[] = [];
    if (ehCandidato) visoes.push('CANDIDATO');
    if (empresas.length > 0) visoes.push('EMPRESA');
    if (this.ehAdmin(usuario)) visoes.push('ADMIN');
    return visoes;
  }
}
