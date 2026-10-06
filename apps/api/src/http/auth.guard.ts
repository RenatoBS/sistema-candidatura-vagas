import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { bypassAdmin, type Acao } from '@scv/domain';

import { AuthService } from '../auth/auth.service';
import { ErroAplicacao } from '../erros';
import type { Repositorio } from '../repositorio/tipos';
import { exigir, montarAtor, type SessaoRequest } from '../sessao';
import { REPOSITORIO } from '../tokens';
import { ACAO, PUBLICO, SENSIVEL } from './decoradores';

interface RequisicaoHttp {
  headers: Record<string, string | string[] | undefined>;
  params: Record<string, string | undefined>;
  sessao?: SessaoRequest;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(REPOSITORIO) private readonly repo: Repositorio,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const publico = this.reflector.getAllAndOverride<boolean>(PUBLICO, [
      context.getHandler(),
      context.getClass(),
    ]);
    const req = context.switchToHttp().getRequest<RequisicaoHttp>();
    if (publico) return true;

    const autorizacao = req.headers.authorization;
    const bruto = typeof autorizacao === 'string' ? autorizacao : '';
    if (!bruto.startsWith('Bearer ')) {
      throw new ErroAplicacao('NAO_AUTENTICADO', 401, 'sessão inválida');
    }
    const payload = this.auth.lerAccess(bruto.slice('Bearer '.length));
    const usuario = await this.repo.buscarUsuarioPorId(payload.sub);
    if (!usuario) throw new ErroAplicacao('NAO_AUTENTICADO', 401, 'sessão inválida');

    const headerEmpresa = req.headers['x-empresa-id'];
    const paramEmpresa = req.params.empresaId;
    const empresaHeader = typeof headerEmpresa === 'string' && headerEmpresa ? headerEmpresa : null;
    if (empresaHeader && paramEmpresa && empresaHeader !== paramEmpresa) {
      throw new ErroAplicacao('EMPRESA_DIVERGENTE', 400, 'empresa do header diverge da rota');
    }
    const empresaId = paramEmpresa ?? empresaHeader ?? payload.empresaId;
    const candidato = await this.repo.buscarCandidatoPorUsuario(usuario.id);
    const admin = bypassAdmin({
      papeisGlobais: usuario.papeisGlobais,
      mfaAtivo: usuario.mfaAtivo,
      mfaVerificado: payload.mfaVerificado,
    });
    const ctx = { empresaId: empresaId ?? undefined, isAdmin: admin };
    const membro = empresaId ? await this.repo.buscarMembro(usuario.id, empresaId, ctx) : null;
    const empresa = empresaId ? await this.repo.buscarEmpresaPorId(empresaId, ctx) : null;
    const base = {
      usuario,
      mfaVerificado: payload.mfaVerificado,
      visao: payload.visao,
      empresaId,
      ehCandidato: Boolean(candidato),
      membro,
      empresa,
    };
    const sessao: SessaoRequest = { ...base, ator: montarAtor(base) };
    req.sessao = sessao;

    if (this.reflector.getAllAndOverride<boolean>(SENSIVEL, [context.getHandler(), context.getClass()])) {
      const reauth = req.headers['x-reauth-token'];
      this.auth.lerReauth(typeof reauth === 'string' ? reauth : undefined, usuario.id);
    }

    const acao = this.reflector.getAllAndOverride<Acao | undefined>(ACAO, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (acao) exigir(sessao, acao);
    return true;
  }
}
