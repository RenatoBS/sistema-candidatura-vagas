import { Body, Controller, Get, Headers, HttpCode, Inject, Param, Post, Query, Req } from '@nestjs/common';
import { revisaoTriagemSchema } from '@scv/contracts';

import type { ConfiguracaoApp } from '../configuracao';
import { ErroAplicacao } from '../erros';
import type { SessaoRequest } from '../sessao';
import { CONFIG } from '../tokens';
import { TranscricaoService } from '../triagem/transcricao.service';
import { AvaliacaoTriagemService } from '../triagem/triagem-avaliacao.service';
import { TriagemConsultaService } from '../triagem/triagem-consulta.service';
import { TriagemInatividadeService } from '../triagem/triagem-inatividade.service';
import { TriagemMonitorService } from '../triagem/triagem-monitor.service';
import { TriagemOrquestradorService } from '../triagem/triagem-orquestrador.service';
import { TriagemRetryService } from '../triagem/triagem-retry.service';
import { Publico } from './decoradores';
import { validar } from './validar';

interface RequisicaoComSessao {
  sessao: SessaoRequest;
}

@Controller()
export class TriagemController {
  constructor(
    @Inject(TranscricaoService) private readonly transcricao: TranscricaoService,
    @Inject(CONFIG) private readonly config: ConfiguracaoApp,
    @Inject(TriagemInatividadeService) private readonly inatividade: TriagemInatividadeService,
    @Inject(TriagemOrquestradorService) private readonly orquestrador: TriagemOrquestradorService,
    @Inject(TriagemRetryService) private readonly retries: TriagemRetryService,
    @Inject(TriagemMonitorService) private readonly monitor: TriagemMonitorService,
    @Inject(TriagemConsultaService) private readonly consulta: TriagemConsultaService,
    @Inject(AvaliacaoTriagemService) private readonly avaliacao: AvaliacaoTriagemService,
  ) {}

  @Publico()
  @HttpCode(200)
  @Post('interno/triagem/respostas/:respostaId/transcrever')
  async transcrever(
    @Param('respostaId') respostaId: string,
    @Headers('x-internal-token') token: string | undefined,
  ) {
    this.validar(token);
    const resultado = await this.transcricao.transcrever(respostaId);
    await this.orquestrador.continuar(respostaId);
    return resultado;
  }

  @Publico()
  @HttpCode(200)
  @Post('interno/triagem/respostas/:respostaId/falha')
  async falha(
    @Param('respostaId') respostaId: string,
    @Headers('x-internal-token') token: string | undefined,
  ) {
    this.validar(token);
    const resultado = await this.transcricao.marcarFalha(respostaId);
    await this.orquestrador.continuar(respostaId);
    return resultado;
  }

  @Publico()
  @HttpCode(200)
  @Post('interno/triagem/respostas/:respostaId/avaliar')
  avaliar(
    @Param('respostaId') respostaId: string,
    @Headers('x-internal-token') token: string | undefined,
  ) {
    this.validar(token);
    return this.avaliacao.avaliar(respostaId);
  }

  @Publico()
  @HttpCode(200)
  @Post('interno/triagem/entrevistas/:entrevistaId/abandonar-inatividade')
  abandonarInatividade(
    @Param('entrevistaId') entrevistaId: string,
    @Headers('x-internal-token') token: string | undefined,
    @Body() body?: { ultimaInteracaoEm?: string },
  ) {
    this.validar(token);
    return this.inatividade.abandonarPorInatividade(
      entrevistaId,
      undefined,
      undefined,
      body?.ultimaInteracaoEm,
    );
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

  @Publico()
  @HttpCode(200)
  @Post('interno/triagem/entrevistas/:entrevistaId/retry')
  retry(
    @Param('entrevistaId') entrevistaId: string,
    @Headers('x-internal-token') token: string | undefined,
    @Body() body?: { numero?: number },
  ) {
    this.validar(token);
    return this.retries.executar(entrevistaId, Number(body?.numero ?? 1));
  }

  @Publico()
  @HttpCode(200)
  @Post('interno/triagem/entrevistas/:entrevistaId/esgotar')
  esgotar(
    @Param('entrevistaId') entrevistaId: string,
    @Headers('x-internal-token') token: string | undefined,
  ) {
    this.validar(token);
    return this.retries.esgotar(entrevistaId);
  }

  @Publico()
  @HttpCode(200)
  @Post('interno/triagem/eventos/:eventoId/processar')
  processar(
    @Param('eventoId') eventoId: string,
    @Headers('x-internal-token') token: string | undefined,
  ) {
    this.validar(token);
    return this.orquestrador.processarEvento(eventoId);
  }

  @Publico()
  @HttpCode(200)
  @Post('interno/triagem/candidaturas/:candidaturaId/iniciar')
  iniciar(
    @Param('candidaturaId') candidaturaId: string,
    @Headers('x-internal-token') token: string | undefined,
  ) {
    this.validar(token);
    return this.orquestrador.iniciar(candidaturaId);
  }

  @Publico()
  @HttpCode(200)
  @Post('interno/triagem/monitorar')
  monitorar(@Headers('x-internal-token') token: string | undefined) {
    this.validar(token);
    return this.monitor.varrer();
  }

  @Get('empresas/:empresaId/vagas/:vagaId/triagens')
  listar(
    @Req() req: RequisicaoComSessao,
    @Param('empresaId') empresaId: string,
    @Param('vagaId') vagaId: string,
  ) {
    return this.consulta.listar(req.sessao, empresaId, vagaId);
  }

  @Get('empresas/:empresaId/triagens/:entrevistaId')
  detalhe(
    @Req() req: RequisicaoComSessao,
    @Param('empresaId') empresaId: string,
    @Param('entrevistaId') entrevistaId: string,
  ) {
    return this.consulta.detalhe(req.sessao, empresaId, entrevistaId);
  }

  @Get('empresas/:empresaId/triagens/:entrevistaId/respostas/:respostaId/audio')
  audio(
    @Req() req: RequisicaoComSessao,
    @Param('empresaId') empresaId: string,
    @Param('entrevistaId') entrevistaId: string,
    @Param('respostaId') respostaId: string,
    @Query('motivo') motivo?: string,
  ) {
    return this.consulta.audio(req.sessao, empresaId, entrevistaId, respostaId, motivo);
  }

  @Post('empresas/:empresaId/triagens/:entrevistaId/respostas/:respostaId/revisao')
  revisar(
    @Req() req: RequisicaoComSessao,
    @Param('empresaId') empresaId: string,
    @Param('entrevistaId') entrevistaId: string,
    @Param('respostaId') respostaId: string,
    @Body() body: unknown,
  ) {
    return this.consulta.revisar(
      req.sessao,
      empresaId,
      entrevistaId,
      respostaId,
      validar(revisaoTriagemSchema, body),
    );
  }

  private validar(token: string | undefined): void {
    if (!this.config.internalToken || token !== this.config.internalToken)
      throw new ErroAplicacao('NAO_AUTENTICADO', 401, 'token interno inválido');
  }
}
