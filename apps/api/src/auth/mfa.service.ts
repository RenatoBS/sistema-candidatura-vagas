import { randomUUID } from 'node:crypto';

import { cifrar, decifrar } from '@scv/providers';

import type { ConfiguracaoApp } from '../configuracao';
import { ErroAplicacao } from '../erros';
import type { Repositorio } from '../repositorio/tipos';
import type { AuthService } from './auth.service';
import type { Relogio } from './auth.service';
import type { SessaoEmitida } from './auth.service';
import { gerarCodigosRecuperacao, gerarSegredoTotp, hashSegredo, totpConfere, uriTotp } from './segredos';

export class MfaService {
  constructor(
    private readonly repo: Repositorio,
    private readonly auth: AuthService,
    private readonly config: ConfiguracaoApp,
    private readonly relogio: Relogio,
  ) {}

  async iniciar(usuarioId: string): Promise<{ otpauthUrl: string }> {
    const usuario = await this.exigir(usuarioId);
    this.exigirChave();
    const segredo = gerarSegredoTotp();
    await this.repo.atualizarUsuario(usuarioId, { mfaSecretCifrado: cifrar(segredo, this.config.encryptionKey), mfaAtivo: false });
    return { otpauthUrl: uriTotp(segredo, usuario.email) };
  }

  async confirmar(usuarioId: string, codigo: string): Promise<{ codigosRecuperacao: string[] }> {
    const usuario = await this.exigir(usuarioId);
    const segredo = this.segredoDe(usuario.mfaSecretCifrado);
    if (!totpConfere(segredo, codigo, this.relogio.agora().getTime())) {
      throw new ErroAplicacao('MFA_INVALIDO', 401, 'código MFA inválido');
    }
    await this.repo.atualizarUsuario(usuarioId, { mfaAtivo: true });
    const codigos = gerarCodigosRecuperacao();
    await this.repo.substituirCodigosMfa(
      usuarioId,
      codigos.map((codigoRecuperacao) => ({
        id: randomUUID(),
        usuarioId,
        codigoHash: hashSegredo(codigoRecuperacao),
        usadoEm: null,
      })),
    );
    return { codigosRecuperacao: codigos };
  }

  async verificar(usuarioId: string, codigo: string, visaoAtual: 'CANDIDATO' | 'EMPRESA' | 'ADMIN', empresaId: string | null): Promise<SessaoEmitida> {
    const usuario = await this.exigir(usuarioId);
    if (!usuario.mfaAtivo) throw new ErroAplicacao('MFA_NAO_CONFIGURADO', 400, 'MFA ainda não foi confirmado');
    const okTotp = totpConfere(this.segredoDe(usuario.mfaSecretCifrado), codigo, this.relogio.agora().getTime());
    const okRecuperacao = okTotp
      ? false
      : await this.repo.consumirCodigoMfa(usuarioId, hashSegredo(codigo.trim()), this.relogio.agora());
    if (!okTotp && !okRecuperacao) {
      throw new ErroAplicacao('MFA_INVALIDO', 401, 'código MFA inválido');
    }
    await this.repo.revogarRefreshDoUsuario(usuarioId, this.relogio.agora());
    return this.auth.emitirSessao(usuario, true, visaoAtual, empresaId);
  }

  async reautenticar(usuarioId: string, entrada: { senha?: string; codigo?: string }): Promise<{ reauthToken: string }> {
    if (entrada.senha) await this.auth.conferirSenha(usuarioId, entrada.senha);
    if (entrada.codigo) {
      const usuario = await this.exigir(usuarioId);
      const ok = usuario.mfaAtivo && totpConfere(this.segredoDe(usuario.mfaSecretCifrado), entrada.codigo, this.relogio.agora().getTime());
      if (!ok) throw new ErroAplicacao('MFA_INVALIDO', 401, 'código MFA inválido');
    }
    return { reauthToken: this.auth.emitirReauth(usuarioId) };
  }

  private exigirChave(): void {
    if (!this.config.encryptionKey) {
      throw new ErroAplicacao('CRIPTOGRAFIA_AUSENTE', 500, 'APP_ENCRYPTION_KEY não configurada');
    }
  }

  private segredoDe(cifrado: string | null): string {
    this.exigirChave();
    if (!cifrado) throw new ErroAplicacao('MFA_NAO_CONFIGURADO', 400, 'MFA ainda não foi iniciado');
    return decifrar(cifrado, this.config.encryptionKey);
  }

  private async exigir(usuarioId: string) {
    const usuario = await this.repo.buscarUsuarioPorId(usuarioId);
    if (!usuario) throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'usuário não encontrado');
    return usuario;
  }
}
