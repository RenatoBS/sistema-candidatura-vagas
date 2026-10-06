import { Body, Controller, Get, Inject, Param, Post, Req } from '@nestjs/common';
import {
  aceitarConviteSchema,
  cadastroEmpresaSchema,
  codigoVerificacaoSchema,
  conviteMembroSchema,
  motivoOpcionalSchema,
  motivoSchema,
} from '@scv/contracts';

import { AuthService } from '../auth/auth.service';
import type { ConfiguracaoApp } from '../configuracao';
import { EmpresasService } from '../empresas/empresas.service';
import { ErroAplicacao } from '../erros';
import { MembrosService } from '../membros/membros.service';
import type { SessaoRequest } from '../sessao';
import { CONFIG } from '../tokens';
import { Publico, Sensivel } from './decoradores';
import { validar } from './validar';

interface RequisicaoComSessao {
  sessao: SessaoRequest;
  headers: Record<string, string | undefined>;
}

@Controller()
export class EmpresasController {
  constructor(
    @Inject(EmpresasService) private readonly empresas: EmpresasService,
    @Inject(MembrosService) private readonly membros: MembrosService,
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(CONFIG) private readonly config: ConfiguracaoApp,
  ) {}

  @Post('empresas/cadastro')
  async cadastrar(@Req() req: RequisicaoComSessao, @Body() body: unknown) {
    const empresa = await this.empresas.cadastrar(req.sessao, validar(cadastroEmpresaSchema, body));
    const sessao = await this.auth.alterarVisao(
      req.sessao.usuario.id,
      req.sessao.mfaVerificado,
      'EMPRESA',
      empresa.id,
    );
    return { empresa, sessao };
  }

  @Post('empresas/:empresaId/verificacao/email')
  email(@Req() req: RequisicaoComSessao, @Param('empresaId') empresaId: string, @Body() body: unknown) {
    return this.empresas.confirmarEmail(req.sessao, empresaId, validar(codigoVerificacaoSchema, body).codigo);
  }

  @Post('empresas/:empresaId/verificacao/dominio')
  dominio(@Req() req: RequisicaoComSessao, @Param('empresaId') empresaId: string) {
    return this.empresas.confirmarDominio(req.sessao, empresaId);
  }

  @Post('empresas/:empresaId/reenviar')
  reenviar(@Req() req: RequisicaoComSessao, @Param('empresaId') empresaId: string) {
    return this.empresas.reenviar(req.sessao, empresaId);
  }

  @Get('empresas/:empresaId')
  obter(@Req() req: RequisicaoComSessao, @Param('empresaId') empresaId: string) {
    return this.empresas.obterParaMembro(req.sessao, empresaId);
  }

  @Post('empresas/:empresaId/vagas/publicar')
  publicar(@Req() req: RequisicaoComSessao, @Param('empresaId') empresaId: string) {
    return this.empresas.publicar(req.sessao, empresaId);
  }

  @Post('empresas/:empresaId/membros/convites')
  convidar(@Req() req: RequisicaoComSessao, @Param('empresaId') empresaId: string, @Body() body: unknown) {
    const dados = validar(conviteMembroSchema, body);
    return this.membros.convidar(req.sessao, empresaId, dados.email, dados.papeis);
  }

  @Get('empresas/:empresaId/membros')
  listarMembros(@Req() req: RequisicaoComSessao, @Param('empresaId') empresaId: string) {
    return this.membros.listar(req.sessao, empresaId);
  }

  @Post('empresas/:empresaId/membros/:membroId/remover')
  remover(
    @Req() req: RequisicaoComSessao,
    @Param('empresaId') empresaId: string,
    @Param('membroId') membroId: string,
  ) {
    return this.membros.remover(req.sessao, empresaId, membroId);
  }

  @Post('convites/aceitar')
  aceitar(@Req() req: RequisicaoComSessao, @Body() body: unknown) {
    return this.membros.aceitar(req.sessao, validar(aceitarConviteSchema, body).token);
  }

  @Publico()
  @Post('interno/empresas/:empresaId/verificar-cnpj')
  interno(@Req() req: RequisicaoComSessao, @Param('empresaId') empresaId: string) {
    const token = req.headers['x-internal-token'];
    if (!this.config.internalToken || token !== this.config.internalToken) {
      throw new ErroAplicacao('NAO_AUTENTICADO', 401, 'token interno inválido');
    }
    return this.empresas.processarCnpj(empresaId);
  }

  @Get('admin/empresas/fila')
  fila(@Req() req: RequisicaoComSessao) {
    return this.empresas.listarFila(req.sessao);
  }

  @Get('admin/empresas')
  listar(@Req() req: RequisicaoComSessao) {
    return this.empresas.listar(req.sessao);
  }

  @Post('admin/empresas/:empresaId/aprovar')
  @Sensivel()
  aprovar(@Req() req: RequisicaoComSessao, @Param('empresaId') empresaId: string, @Body() body: unknown) {
    return this.empresas.moderar(req.sessao, empresaId, 'aprovar', validar(motivoOpcionalSchema, body ?? {}).motivo);
  }

  @Post('admin/empresas/:empresaId/rejeitar')
  @Sensivel()
  rejeitar(@Req() req: RequisicaoComSessao, @Param('empresaId') empresaId: string, @Body() body: unknown) {
    return this.empresas.moderar(req.sessao, empresaId, 'rejeitar', validar(motivoSchema, body).motivo);
  }

  @Post('admin/empresas/:empresaId/suspender')
  @Sensivel()
  suspender(@Req() req: RequisicaoComSessao, @Param('empresaId') empresaId: string, @Body() body: unknown) {
    return this.empresas.moderar(req.sessao, empresaId, 'suspender', validar(motivoSchema, body).motivo);
  }

  @Post('admin/empresas/:empresaId/reativar')
  @Sensivel()
  reativar(@Req() req: RequisicaoComSessao, @Param('empresaId') empresaId: string, @Body() body: unknown) {
    return this.empresas.moderar(req.sessao, empresaId, 'reativar', validar(motivoOpcionalSchema, body ?? {}).motivo);
  }
}
