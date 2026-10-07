import { Body, Controller, Get, Headers, HttpCode, Inject, Param, Post, Query, Req } from '@nestjs/common';

import type { ConfiguracaoApp } from '../configuracao';
import { ErroAplicacao } from '../erros';
import type { SessaoRequest } from '../sessao';
import { CONFIG } from '../tokens';
import { VozService } from '../voz/voz.service';
import { Publico } from './decoradores';

interface RequisicaoComSessao {
  sessao: SessaoRequest;
}

@Controller()
export class VozController {
  constructor(
    @Inject(VozService) private readonly voz: VozService,
    @Inject(CONFIG) private readonly config: ConfiguracaoApp,
  ) {}

  @Publico()
  @HttpCode(200)
  @Post('interno/voz/candidaturas/:candidaturaId/preparar')
  prepararInterno(
    @Param('candidaturaId') candidaturaId: string,
    @Headers('x-internal-token') token: string | undefined,
  ) {
    this.validar(token);
    return this.voz.preparar(candidaturaId);
  }

  @Publico()
  @HttpCode(200)
  @Post('interno/voz/entrevistas/:entrevistaId/aceitar')
  aceitarInterno(
    @Param('entrevistaId') entrevistaId: string,
    @Headers('x-internal-token') token: string | undefined,
  ) {
    this.validar(token);
    return this.voz.aceitar(entrevistaId);
  }

  @Publico()
  @HttpCode(200)
  @Post('interno/voz/sessoes/:sessaoId/turno')
  turnoInterno(
    @Param('sessaoId') sessaoId: string,
    @Headers('x-internal-token') token: string | undefined,
    @Body() body: { texto?: string },
  ) {
    this.validar(token);
    return this.voz.turno(sessaoId, body.texto ?? '');
  }

  @Publico()
  @HttpCode(200)
  @Post('interno/voz/sessoes/:sessaoId/expirar')
  expirarInterno(@Param('sessaoId') sessaoId: string, @Headers('x-internal-token') token: string | undefined) {
    this.validar(token);
    return this.voz.expirar(sessaoId);
  }

  @Publico()
  @HttpCode(200)
  @Post('interno/voz/sessoes/:sessaoId/desconectar')
  desconectarInterno(@Param('sessaoId') sessaoId: string, @Headers('x-internal-token') token: string | undefined) {
    this.validar(token);
    return this.voz.desconectar(sessaoId);
  }

  @Publico()
  @HttpCode(200)
  @Post('interno/voz/sessoes/:sessaoId/reconectar')
  reconectarInterno(@Param('sessaoId') sessaoId: string, @Headers('x-internal-token') token: string | undefined) {
    this.validar(token);
    return this.voz.reconectar(sessaoId);
  }

  @Publico()
  @HttpCode(200)
  @Post('interno/voz/sessoes/:sessaoId/encerrar')
  encerrarInterno(@Param('sessaoId') sessaoId: string, @Headers('x-internal-token') token: string | undefined) {
    this.validar(token);
    return this.voz.encerrar(sessaoId);
  }

  @Publico()
  @HttpCode(200)
  @Get('interno/voz/entrevistas/:entrevistaId/visao')
  visaoInterna(
    @Param('entrevistaId') entrevistaId: string,
    @Headers('x-internal-token') token: string | undefined,
  ) {
    this.validar(token);
    return this.voz.visao(entrevistaId);
  }

  @HttpCode(200)
  @Post('voz/candidaturas/:candidaturaId/preparar')
  async preparar(@Req() req: RequisicaoComSessao, @Param('candidaturaId') candidaturaId: string) {
    await this.voz.garantirDonoCandidatura(req.sessao.usuario.id, candidaturaId);
    return this.voz.preparar(candidaturaId);
  }

  @HttpCode(200)
  @Post('voz/entrevistas/:entrevistaId/aceitar')
  async aceitar(@Req() req: RequisicaoComSessao, @Param('entrevistaId') entrevistaId: string) {
    await this.voz.garantirDonoEntrevista(req.sessao.usuario.id, entrevistaId);
    return this.voz.aceitar(entrevistaId);
  }

  @HttpCode(200)
  @Post('voz/sessoes/:sessaoId/turno')
  async turno(@Req() req: RequisicaoComSessao, @Param('sessaoId') sessaoId: string, @Body() body: { texto?: string }) {
    await this.voz.garantirDonoSessao(req.sessao.usuario.id, sessaoId);
    return this.voz.turno(sessaoId, body.texto ?? '');
  }

  @HttpCode(200)
  @Post('voz/sessoes/:sessaoId/desconectar')
  async desconectar(@Req() req: RequisicaoComSessao, @Param('sessaoId') sessaoId: string) {
    await this.voz.garantirDonoSessao(req.sessao.usuario.id, sessaoId);
    return this.voz.desconectar(sessaoId);
  }

  @HttpCode(200)
  @Post('voz/sessoes/:sessaoId/reconectar')
  async reconectar(@Req() req: RequisicaoComSessao, @Param('sessaoId') sessaoId: string) {
    await this.voz.garantirDonoSessao(req.sessao.usuario.id, sessaoId);
    return this.voz.reconectar(sessaoId);
  }

  @HttpCode(200)
  @Post('voz/sessoes/:sessaoId/encerrar')
  async encerrar(@Req() req: RequisicaoComSessao, @Param('sessaoId') sessaoId: string) {
    await this.voz.garantirDonoSessao(req.sessao.usuario.id, sessaoId);
    return this.voz.encerrar(sessaoId);
  }

  @Get('voz/entrevistas/:entrevistaId')
  async visao(@Req() req: RequisicaoComSessao, @Param('entrevistaId') entrevistaId: string) {
    await this.voz.garantirDonoEntrevista(req.sessao.usuario.id, entrevistaId);
    return this.voz.visao(entrevistaId);
  }

  @Get('empresas/:empresaId/vagas/:vagaId/voz')
  listar(
    @Req() req: RequisicaoComSessao,
    @Param('empresaId') empresaId: string,
    @Param('vagaId') vagaId: string,
  ) {
    return this.voz.listar(req.sessao, empresaId, vagaId);
  }

  @Get('empresas/:empresaId/voz/:entrevistaId')
  detalhe(
    @Req() req: RequisicaoComSessao,
    @Param('empresaId') empresaId: string,
    @Param('entrevistaId') entrevistaId: string,
  ) {
    return this.voz.detalhe(req.sessao, empresaId, entrevistaId);
  }

  @Get('empresas/:empresaId/voz/:entrevistaId/gravacao')
  gravacao(
    @Req() req: RequisicaoComSessao,
    @Param('empresaId') empresaId: string,
    @Param('entrevistaId') entrevistaId: string,
    @Query('motivo') motivo?: string,
  ) {
    return this.voz.gravacao(req.sessao, empresaId, entrevistaId, motivo);
  }

  @HttpCode(200)
  @Post('empresas/:empresaId/voz/:entrevistaId/respostas/:respostaId/revisao')
  revisar(
    @Req() req: RequisicaoComSessao,
    @Param('empresaId') empresaId: string,
    @Param('entrevistaId') entrevistaId: string,
    @Param('respostaId') respostaId: string,
    @Body() body: { nota?: number; justificativa?: string },
  ) {
    return this.voz.revisar(req.sessao, empresaId, entrevistaId, respostaId, {
      nota: Number(body.nota),
      justificativa: body.justificativa ?? '',
    });
  }

  @HttpCode(200)
  @Post('empresas/:empresaId/voz/:entrevistaId/excecao')
  excecao(
    @Req() req: RequisicaoComSessao,
    @Param('empresaId') empresaId: string,
    @Param('entrevistaId') entrevistaId: string,
    @Body() body: { motivo?: string },
  ) {
    return this.voz.excecao(req.sessao, empresaId, entrevistaId, body.motivo ?? '');
  }

  private validar(token: string | undefined): void {
    if (!this.config.internalToken || token !== this.config.internalToken) {
      throw new ErroAplicacao('NAO_AUTENTICADO', 401, 'token interno inválido');
    }
  }
}
