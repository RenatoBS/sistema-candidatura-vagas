import { Controller, Headers, HttpCode, Inject, Param, Post } from '@nestjs/common';
import type { ConfiguracaoApp } from '../configuracao';
import { ErroAplicacao } from '../erros';
import { CONFIG } from '../tokens';
import { TranscricaoService } from '../triagem/transcricao.service';
import { TriagemInatividadeService } from '../triagem/triagem-inatividade.service';
import { Publico } from './decoradores';

@Controller()
export class TriagemController {
  constructor(
    @Inject(TranscricaoService) private readonly transcricao: TranscricaoService,
    @Inject(CONFIG) private readonly config: ConfiguracaoApp,
    @Inject(TriagemInatividadeService) private readonly inatividade: TriagemInatividadeService,
  ) {}
  @Publico()
  @HttpCode(200)
  @Post('interno/triagem/respostas/:respostaId/transcrever')
  transcrever(
    @Param('respostaId') respostaId: string,
    @Headers('x-internal-token') token: string | undefined,
  ) {
    this.validar(token);
    return this.transcricao.transcrever(respostaId);
  }
  @Publico()
  @HttpCode(200)
  @Post('interno/triagem/respostas/:respostaId/falha')
  falha(
    @Param('respostaId') respostaId: string,
    @Headers('x-internal-token') token: string | undefined,
  ) {
    this.validar(token);
    return this.transcricao.marcarFalha(respostaId);
  }
  @Publico()
  @HttpCode(200)
  @Post('interno/triagem/entrevistas/:entrevistaId/abandonar-inatividade')
  abandonarInatividade(
    @Param('entrevistaId') entrevistaId: string,
    @Headers('x-internal-token') token: string | undefined,
  ) {
    this.validar(token);
    return this.inatividade.abandonarPorInatividade(entrevistaId);
  }
  @Publico()
  @HttpCode(200)
  @Post('interno/triagem/entrevistas/:entrevistaId/aceitar')
  aceitar(
    @Param('entrevistaId') entrevistaId: string,
    @Headers('x-internal-token') token: string | undefined,
  ) {
    this.validar(token);
    return this.inatividade.registrarAceite(entrevistaId);
  }
  private validar(token: string | undefined): void {
    if (!this.config.internalToken || token !== this.config.internalToken)
      throw new ErroAplicacao('NAO_AUTENTICADO', 401, 'token interno inválido');
  }
}
