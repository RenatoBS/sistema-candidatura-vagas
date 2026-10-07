import { Body, Controller, Get, Headers, HttpCode, Inject, Param, Post, Put, Query, Req } from '@nestjs/common';
import type { PesosScore } from '@scv/domain';

import type { ConfiguracaoApp } from '../configuracao';
import { ErroAplicacao } from '../erros';
import { RankingService } from '../ranking/ranking.service';
import type { SessaoRequest } from '../sessao';
import { CONFIG } from '../tokens';
import { Publico } from './decoradores';

interface RequisicaoComSessao {
  sessao: SessaoRequest;
}

@Controller()
export class RankingController {
  constructor(
    @Inject(RankingService) private readonly ranking: RankingService,
    @Inject(CONFIG) private readonly config: ConfiguracaoApp,
  ) {}

  @Publico()
  @HttpCode(200)
  @Post('interno/ranking/vagas/:vagaId/recalcular')
  recalcular(
    @Param('vagaId') vagaId: string,
    @Headers('x-internal-token') token: string | undefined,
    @Body() body?: { forcar?: boolean },
  ) {
    this.validar(token);
    return this.ranking.recalcular(vagaId, body?.forcar === true);
  }

  @Get('empresas/:empresaId/vagas/:vagaId/ranking')
  listar(
    @Req() req: RequisicaoComSessao,
    @Param('empresaId') empresaId: string,
    @Param('vagaId') vagaId: string,
    @Query('completudeMin') completudeMin?: string,
  ) {
    return this.ranking.listar(req.sessao, empresaId, vagaId, {
      completudeMin: completudeMin ? Number(completudeMin) : 0,
    });
  }

  @Get('empresas/:empresaId/vagas/:vagaId/ranking/vies')
  vies(@Req() req: RequisicaoComSessao, @Param('empresaId') empresaId: string, @Param('vagaId') vagaId: string) {
    return this.ranking.vies(req.sessao, empresaId, vagaId);
  }

  @HttpCode(200)
  @Put('empresas/:empresaId/vagas/:vagaId/ranking/pesos')
  pesos(
    @Req() req: RequisicaoComSessao,
    @Param('empresaId') empresaId: string,
    @Param('vagaId') vagaId: string,
    @Body() body: Partial<PesosScore>,
  ) {
    return this.ranking.definirPesos(req.sessao, empresaId, vagaId, body as PesosScore);
  }

  @HttpCode(200)
  @Post('empresas/:empresaId/ranking/respostas/:respostaId/revisao')
  revisar(
    @Req() req: RequisicaoComSessao,
    @Param('empresaId') empresaId: string,
    @Param('respostaId') respostaId: string,
    @Body() body: { nota?: number; justificativa?: string },
  ) {
    return this.ranking.revisar(req.sessao, empresaId, respostaId, {
      nota: Number(body.nota),
      justificativa: body.justificativa ?? '',
    });
  }

  private validar(token: string | undefined): void {
    if (!this.config.internalToken || token !== this.config.internalToken) {
      throw new ErroAplicacao('NAO_AUTENTICADO', 401, 'token interno inválido');
    }
  }
}
