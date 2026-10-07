import { Body, Controller, Get, Inject, Param, Patch, Post, Put, Query, Req } from '@nestjs/common';
import {
  candidaturaDiretaSchema,
  atualizarVagaSchema,
  criarPerguntaSchema,
  criarVagaSchema,
  fecharVagaSchema,
  prorrogarVagaSchema,
  consultaVagasPublicasSchema,
  revisarSugestaoSchema,
  salvarProcessoSchema,
  vincularPerguntaSchema,
} from '@scv/contracts';

import { CandidaturasService } from '../candidaturas/candidaturas.service';
import type { ConfiguracaoApp } from '../configuracao';
import { ErroAplicacao } from '../erros';
import type { SessaoRequest } from '../sessao';
import { CONFIG } from '../tokens';
import { VagasService } from '../vagas/vagas.service';
import { Exige, Publico } from './decoradores';
import { validar } from './validar';

interface RequisicaoComSessao {
  sessao: SessaoRequest;
  headers: Record<string, string | undefined>;
}

@Controller()
export class VagasController {
  constructor(
    @Inject(VagasService) private readonly vagas: VagasService,
    @Inject(CONFIG) private readonly config: ConfiguracaoApp,
    @Inject(CandidaturasService) private readonly candidaturas: CandidaturasService,
  ) {}

  @Publico()
  @Get('habilidades')
  habilidades() {
    return this.vagas.listarCatalogo();
  }

  @Post('empresas/:empresaId/vagas')
  @Exige('criar_vaga')
  criar(@Req() req: RequisicaoComSessao, @Param('empresaId') empresaId: string, @Body() body: unknown) {
    return this.vagas.criar(req.sessao, empresaId, validar(criarVagaSchema, body));
  }

  @Get('empresas/:empresaId/vagas')
  @Exige('criar_vaga')
  listar(@Req() req: RequisicaoComSessao, @Param('empresaId') empresaId: string) {
    return this.vagas.listar(req.sessao, empresaId);
  }

  @Get('empresas/:empresaId/vagas/:vagaId')
  @Exige('criar_vaga')
  obter(@Req() req: RequisicaoComSessao, @Param('empresaId') empresaId: string, @Param('vagaId') vagaId: string) {
    return this.vagas.obter(req.sessao, empresaId, vagaId);
  }

  @Patch('empresas/:empresaId/vagas/:vagaId')
  @Exige('criar_vaga')
  atualizar(
    @Req() req: RequisicaoComSessao,
    @Param('empresaId') empresaId: string,
    @Param('vagaId') vagaId: string,
    @Body() body: unknown,
  ) {
    return this.vagas.atualizar(req.sessao, empresaId, vagaId, validar(atualizarVagaSchema, body));
  }

  @Put('empresas/:empresaId/vagas/:vagaId/processo')
  @Exige('criar_vaga')
  processo(
    @Req() req: RequisicaoComSessao,
    @Param('empresaId') empresaId: string,
    @Param('vagaId') vagaId: string,
    @Body() body: unknown,
  ) {
    return this.vagas.salvarProcesso(req.sessao, empresaId, vagaId, validar(salvarProcessoSchema, body));
  }

  @Get('empresas/:empresaId/perguntas')
  @Exige('criar_vaga')
  perguntas(@Req() req: RequisicaoComSessao, @Param('empresaId') empresaId: string) {
    return this.vagas.listarPerguntas(req.sessao, empresaId);
  }

  @Post('empresas/:empresaId/perguntas')
  @Exige('criar_vaga')
  criarPergunta(@Req() req: RequisicaoComSessao, @Param('empresaId') empresaId: string, @Body() body: unknown) {
    return this.vagas.criarPerguntaBanco(req.sessao, empresaId, validar(criarPerguntaSchema, body));
  }

  @Post('empresas/:empresaId/vagas/:vagaId/etapas/:etapaId/perguntas')
  @Exige('criar_vaga')
  adicionar(
    @Req() req: RequisicaoComSessao,
    @Param('empresaId') empresaId: string,
    @Param('vagaId') vagaId: string,
    @Param('etapaId') etapaId: string,
    @Body() body: unknown,
  ) {
    return this.vagas.adicionarPergunta(req.sessao, empresaId, vagaId, etapaId, validar(vincularPerguntaSchema, body));
  }

  @Post('empresas/:empresaId/vagas/:vagaId/etapas/:etapaId/perguntas/sugestoes')
  @Exige('criar_vaga')
  sugerir(
    @Req() req: RequisicaoComSessao,
    @Param('empresaId') empresaId: string,
    @Param('vagaId') vagaId: string,
    @Param('etapaId') etapaId: string,
  ) {
    return this.vagas.sugerir(req.sessao, empresaId, vagaId, etapaId);
  }

  @Post('empresas/:empresaId/perguntas/:perguntaId/aceitar')
  @Exige('criar_vaga')
  aceitar(
    @Req() req: RequisicaoComSessao,
    @Param('empresaId') empresaId: string,
    @Param('perguntaId') perguntaId: string,
    @Body() body: unknown,
  ) {
    return this.vagas.aceitarSugestao(req.sessao, empresaId, perguntaId, validar(revisarSugestaoSchema, body ?? {}));
  }

  @Post('empresas/:empresaId/perguntas/:perguntaId/descartar')
  @Exige('criar_vaga')
  descartar(@Req() req: RequisicaoComSessao, @Param('empresaId') empresaId: string, @Param('perguntaId') perguntaId: string) {
    return this.vagas.descartarSugestao(req.sessao, empresaId, perguntaId);
  }

  @Patch('empresas/:empresaId/perguntas/:perguntaId')
  @Exige('criar_vaga')
  revisar(
    @Req() req: RequisicaoComSessao,
    @Param('empresaId') empresaId: string,
    @Param('perguntaId') perguntaId: string,
    @Body() body: unknown,
  ) {
    return this.vagas.revisarPergunta(req.sessao, empresaId, perguntaId, validar(revisarSugestaoSchema, body));
  }

  @Post('empresas/:empresaId/vagas/:vagaId/publicar')
  @Exige('publicar_vaga')
  publicar(@Req() req: RequisicaoComSessao, @Param('empresaId') empresaId: string, @Param('vagaId') vagaId: string) {
    return this.vagas.publicar(req.sessao, empresaId, vagaId);
  }

  @Post('empresas/:empresaId/vagas/:vagaId/prorrogar')
  @Exige('pausar_vaga')
  prorrogar(
    @Req() req: RequisicaoComSessao,
    @Param('empresaId') empresaId: string,
    @Param('vagaId') vagaId: string,
    @Body() body: unknown,
  ) {
    return this.vagas.prorrogar(req.sessao, empresaId, vagaId, validar(prorrogarVagaSchema, body).prazoInscricoes);
  }

  @Post('empresas/:empresaId/vagas/:vagaId/pausar')
  @Exige('pausar_vaga')
  pausar(@Req() req: RequisicaoComSessao, @Param('empresaId') empresaId: string, @Param('vagaId') vagaId: string) {
    return this.vagas.pausar(req.sessao, empresaId, vagaId);
  }

  @Post('empresas/:empresaId/vagas/:vagaId/retomar')
  @Exige('pausar_vaga')
  retomar(@Req() req: RequisicaoComSessao, @Param('empresaId') empresaId: string, @Param('vagaId') vagaId: string) {
    return this.vagas.retomar(req.sessao, empresaId, vagaId);
  }

  @Post('empresas/:empresaId/vagas/:vagaId/fechar')
  @Exige('pausar_vaga')
  fechar(
    @Req() req: RequisicaoComSessao,
    @Param('empresaId') empresaId: string,
    @Param('vagaId') vagaId: string,
    @Body() body: unknown,
  ) {
    return this.vagas.fechar(req.sessao, empresaId, vagaId, validar(fecharVagaSchema, body).motivo);
  }

  @Post('empresas/:empresaId/vagas/:vagaId/duplicar')
  @Exige('criar_vaga')
  duplicar(@Req() req: RequisicaoComSessao, @Param('empresaId') empresaId: string, @Param('vagaId') vagaId: string) {
    return this.vagas.duplicar(req.sessao, empresaId, vagaId);
  }

  @Publico()
  @Get('vagas-publicas')
  publicas(@Query() query: unknown) {
    return this.vagas.listarPublicas(validar(consultaVagasPublicasSchema, query ?? {}));
  }

  @Publico()
  @Get('vagas-publicas/:vagaId')
  publica(@Param('vagaId') vagaId: string) {
    return this.vagas.obterPublica(vagaId);
  }

  @Post('vagas-publicas/:vagaId/candidaturas')
  @Exige('candidatar')
  inscricao(@Req() req: RequisicaoComSessao, @Param('vagaId') vagaId: string, @Body() body: unknown) {
    if (body === undefined || body === null) return this.vagas.verificarInscricao(req.sessao, vagaId);
    return this.candidaturas.criar(req.sessao, vagaId, validar(candidaturaDiretaSchema, body).consentimentos);
  }

  @Get('vagas/:vagaId/candidaturas')
  @Exige('criar_vaga')
  candidaturasDaVaga(@Req() req: RequisicaoComSessao, @Param('vagaId') vagaId: string) { return this.candidaturas.daVaga(req.sessao, vagaId); }

  @Publico()
  @Post('interno/vagas/reconciliar')
  reconciliar(@Req() req: RequisicaoComSessao) {
    this.interno(req);
    return this.vagas.reconciliar();
  }

  @Publico()
  @Post('interno/vagas/:vagaId/encerrar-inscricoes')
  encerrar(@Req() req: RequisicaoComSessao, @Param('vagaId') vagaId: string) {
    this.interno(req);
    return this.vagas.encerrarJob(vagaId);
  }

  @Publico()
  @Post('interno/etapas/:etapaId/sugerir')
  sugerirJob(@Req() req: RequisicaoComSessao, @Param('etapaId') etapaId: string) {
    this.interno(req);
    return this.vagas.sugerirJob(etapaId);
  }

  @Publico()
  @Post('interno/eventos-vaga/:eventoId/aplicar')
  evento(@Req() req: RequisicaoComSessao, @Param('eventoId') eventoId: string) {
    this.interno(req);
    return this.vagas.aplicarEvento(eventoId);
  }

  private interno(req: RequisicaoComSessao): void {
    const token = req.headers['x-internal-token'];
    if (!this.config.internalToken || token !== this.config.internalToken) {
      throw new ErroAplicacao('NAO_AUTENTICADO', 401, 'token interno inválido');
    }
  }
}
