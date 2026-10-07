import { Controller, Get, HttpCode, Inject, Param, Post, Req } from '@nestjs/common';

import type { ConfiguracaoApp } from '../configuracao';
import { ErroAplicacao } from '../erros';
import { MatchService } from '../match/match.service';
import type { SessaoRequest } from '../sessao';
import { CONFIG } from '../tokens';
import { Exige, Publico } from './decoradores';

interface RequisicaoComSessao {
  sessao: SessaoRequest;
  headers: Record<string, string | string[] | undefined>;
}

@Controller()
export class MatchController {
  constructor(
    @Inject(MatchService) private readonly match: MatchService,
    @Inject(CONFIG) private readonly config: ConfiguracaoApp,
  ) {}

  @Get('vagas/:vagaId/sugestoes-match')
  @Exige('criar_vaga')
  sugestoes(@Req() req: RequisicaoComSessao, @Param('vagaId') vagaId: string) {
    return this.match.sugestoesDaVaga(req.sessao, vagaId);
  }

  @Get('candidatos/me/vagas-recomendadas')
  @Exige('editar_proprio_perfil')
  recomendadas(@Req() req: RequisicaoComSessao) {
    return this.match.vagasRecomendadas(req.sessao);
  }

  @Publico()
  @HttpCode(200)
  @Post('interno/match/embeddings/vagas/:vagaId')
  embeddingVaga(@Req() req: RequisicaoComSessao, @Param('vagaId') vagaId: string) {
    this.interno(req);
    return this.match.gerarEmbeddingVaga(vagaId);
  }

  @Publico()
  @HttpCode(200)
  @Post('interno/match/embeddings/candidatos/:candidatoId')
  embeddingCandidato(@Req() req: RequisicaoComSessao, @Param('candidatoId') candidatoId: string) {
    this.interno(req);
    return this.match.gerarEmbeddingCandidato(candidatoId);
  }

  @Publico()
  @HttpCode(200)
  @Post('interno/match/vagas/:vagaId')
  matchVaga(@Req() req: RequisicaoComSessao, @Param('vagaId') vagaId: string) {
    this.interno(req);
    return this.match.matchVaga(vagaId);
  }

  @Publico()
  @HttpCode(200)
  @Post('interno/match/candidatos/:candidatoId')
  matchCandidato(@Req() req: RequisicaoComSessao, @Param('candidatoId') candidatoId: string) {
    this.interno(req);
    return this.match.matchCandidato(candidatoId);
  }

  private interno(req: RequisicaoComSessao): void {
    const token = req.headers['x-internal-token'];
    if (!this.config.internalToken || token !== this.config.internalToken) {
      throw new ErroAplicacao('NAO_AUTENTICADO', 401, 'token interno inválido');
    }
  }
}
