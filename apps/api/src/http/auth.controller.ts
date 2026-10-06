import { Body, Controller, Get, Inject, Patch, Post, Req } from '@nestjs/common';
import {
  alterarVisaoSchema,
  cadastroAuthSchema,
  confirmarEmailSchema,
  loginSchema,
  mfaCodigoSchema,
  onboardingCandidatoSchema,
  reautenticarSchema,
  recuperarSenhaSchema,
  redefinirSenhaSchema,
  refreshSchema,
} from '@scv/contracts';

import { AuthService } from '../auth/auth.service';
import { MfaService } from '../auth/mfa.service';
import type { SessaoRequest } from '../sessao';
import { Publico } from './decoradores';
import { validar } from './validar';

interface RequisicaoComSessao {
  sessao: SessaoRequest;
}

@Controller()
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(MfaService) private readonly mfa: MfaService,
  ) {}

  @Publico()
  @Post('auth/cadastro')
  cadastrar(@Body() body: unknown) {
    return this.auth.cadastrar(validar(cadastroAuthSchema, body));
  }

  @Publico()
  @Post('auth/login')
  login(@Body() body: unknown) {
    return this.auth.login(validar(loginSchema, body));
  }

  @Publico()
  @Post('auth/refresh')
  refresh(@Body() body: unknown) {
    return this.auth.refresh(validar(refreshSchema, body).refreshToken);
  }

  @Publico()
  @Post('auth/logout')
  logout(@Body() body: unknown) {
    return this.auth.logout(validar(refreshSchema, body).refreshToken);
  }

  @Publico()
  @Post('auth/recuperar')
  recuperar(@Body() body: unknown) {
    return this.auth.recuperarSenha(validar(recuperarSenhaSchema, body).email);
  }

  @Publico()
  @Post('auth/redefinir')
  redefinir(@Body() body: unknown) {
    const dados = validar(redefinirSenhaSchema, body);
    return this.auth.redefinirSenha(dados.token, dados.senha);
  }

  @Publico()
  @Post('auth/confirmar-email')
  confirmarEmail(@Body() body: unknown) {
    return this.auth.confirmarEmail(validar(confirmarEmailSchema, body).token);
  }

  @Get('me')
  me(@Req() req: RequisicaoComSessao) {
    const sessao = req.sessao;
    return this.auth.me(sessao.usuario.id, sessao.mfaVerificado, sessao.visao, sessao.empresaId);
  }

  @Patch('me/visao')
  visao(@Req() req: RequisicaoComSessao, @Body() body: unknown) {
    const dados = validar(alterarVisaoSchema, body);
    return this.auth.alterarVisao(req.sessao.usuario.id, req.sessao.mfaVerificado, dados.visao, dados.empresaId);
  }

  @Post('onboarding/candidato')
  candidato(@Req() req: RequisicaoComSessao, @Body() body: unknown) {
    const dados = validar(onboardingCandidatoSchema, body);
    return this.auth.tornarCandidato(req.sessao.usuario.id, dados.nome, req.sessao.mfaVerificado);
  }

  @Post('auth/mfa/iniciar')
  iniciarMfa(@Req() req: RequisicaoComSessao) {
    return this.mfa.iniciar(req.sessao.usuario.id);
  }

  @Post('auth/mfa/confirmar')
  confirmarMfa(@Req() req: RequisicaoComSessao, @Body() body: unknown) {
    return this.mfa.confirmar(req.sessao.usuario.id, validar(mfaCodigoSchema, body).codigo);
  }

  @Post('auth/mfa/verificar')
  verificarMfa(@Req() req: RequisicaoComSessao, @Body() body: unknown) {
    return this.mfa.verificar(
      req.sessao.usuario.id,
      validar(mfaCodigoSchema, body).codigo,
      req.sessao.visao,
      req.sessao.empresaId,
    );
  }

  @Post('auth/reautenticar')
  reautenticar(@Req() req: RequisicaoComSessao, @Body() body: unknown) {
    return this.mfa.reautenticar(req.sessao.usuario.id, validar(reautenticarSchema, body));
  }
}
