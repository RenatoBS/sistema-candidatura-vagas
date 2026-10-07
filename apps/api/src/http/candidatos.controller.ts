import type { IncomingMessage } from 'node:http';

import { Body, Controller, Get, HttpCode, Inject, Param, Post, Put, Req } from '@nestjs/common';
import {
  atualizarPerfilSchema,
  confirmarCurriculoSchema,
  consentimentoSchema,
  excluirDadosSchema,
  habilidadesCandidatoSchema,
  registrarCurriculoSchema,
  uploadCurriculoSchema,
} from '@scv/contracts';
import type { DadosCurriculo } from '@scv/domain';
import { ArmazenamentoMemoria, type Armazenamento } from '@scv/providers';

import { ConsentimentoService, CurriculoService, LgpdService, PerfilService } from '../candidatos/candidato.service';
import { CandidaturasService } from '../candidaturas/candidaturas.service';
import type { ConfiguracaoApp } from '../configuracao';
import { ErroAplicacao } from '../erros';
import type { SessaoRequest } from '../sessao';
import { ARMAZENAMENTO, CONFIG } from '../tokens';
import { Exige, Publico, Sensivel } from './decoradores';
import { validar } from './validar';

interface RequisicaoComSessao {
  sessao: SessaoRequest;
  headers: Record<string, string | string[] | undefined>;
  protocol?: string;
}

function cabecalho(req: RequisicaoComSessao, nome: string): string | undefined {
  const valor = req.headers[nome];
  return typeof valor === 'string' ? valor : undefined;
}

function baseApi(req: RequisicaoComSessao): string {
  const host = cabecalho(req, 'host') ?? 'localhost';
  const proto = cabecalho(req, 'x-forwarded-proto') ?? req.protocol ?? 'http';
  return `${proto}://${host}/api/v1`;
}

function lerCorpo(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const partes: Buffer[] = [];
    req.on('data', (parte: Buffer) => partes.push(Buffer.from(parte)));
    req.on('end', () => resolve(Buffer.concat(partes)));
    req.on('error', reject);
  });
}

@Controller()
export class CandidatoController {
  constructor(
    @Inject(PerfilService) private readonly perfil: PerfilService,
    @Inject(CurriculoService) private readonly curriculos: CurriculoService,
    @Inject(ConsentimentoService) private readonly consentimentos: ConsentimentoService,
    @Inject(LgpdService) private readonly lgpd: LgpdService,
    @Inject(ARMAZENAMENTO) private readonly armazenamento: Armazenamento,
    @Inject(CONFIG) private readonly config: ConfiguracaoApp,
    @Inject(CandidaturasService) private readonly candidaturas: CandidaturasService,
  ) {}

  @Exige('editar_proprio_perfil')
  @Get('candidatos/me')
  obter(@Req() req: RequisicaoComSessao) {
    return this.perfil.obter(req.sessao.usuario.id);
  }

  @Exige('editar_proprio_perfil')
  @Put('candidatos/me')
  atualizar(@Req() req: RequisicaoComSessao, @Body() body: unknown) {
    return this.perfil.atualizar(req.sessao.usuario.id, validar(atualizarPerfilSchema, body));
  }

  @Exige('editar_proprio_perfil')
  @Get('candidatos/me/habilidades')
  habilidades(@Req() req: RequisicaoComSessao) {
    return this.perfil.listarHabilidades(req.sessao.usuario.id);
  }

  @Exige('editar_proprio_perfil')
  @Put('candidatos/me/habilidades')
  salvarHabilidades(@Req() req: RequisicaoComSessao, @Body() body: unknown) {
    return this.perfil.substituirHabilidades(req.sessao.usuario.id, validar(habilidadesCandidatoSchema, body).itens);
  }

  @Exige('editar_proprio_perfil')
  @Get('candidatos/me/consentimentos')
  listarConsentimentos(@Req() req: RequisicaoComSessao) {
    return this.consentimentos.listar(req.sessao.usuario.id);
  }

  @Exige('editar_proprio_perfil')
  @Post('candidatos/me/consentimentos')
  consentir(@Req() req: RequisicaoComSessao, @Body() body: unknown) {
    return this.consentimentos.registrar(req.sessao.usuario.id, validar(consentimentoSchema, body));
  }

  @Exige('editar_proprio_perfil')
  @Get('candidatos/me/candidaturas')
  minhasCandidaturas(@Req() req: RequisicaoComSessao) { return this.candidaturas.minhas(req.sessao); }

  @Exige('editar_proprio_perfil')
  @Get('candidatos/me/candidaturas/:id')
  minhaCandidatura(@Req() req: RequisicaoComSessao, @Param('id') id: string) { return this.candidaturas.minha(req.sessao, id); }

  @Exige('editar_proprio_perfil')
  @Post('curriculos/upload-url')
  upload(@Req() req: RequisicaoComSessao, @Body() body: unknown) {
    const dados = validar(uploadCurriculoSchema, body);
    return this.curriculos.criarUpload(req.sessao.usuario.id, dados.mimeType, dados.tamanhoBytes, baseApi(req));
  }

  @Exige('editar_proprio_perfil')
  @Post('curriculos')
  registrar(@Req() req: RequisicaoComSessao, @Body() body: unknown) {
    const dados = validar(registrarCurriculoSchema, body);
    return this.curriculos.registrar(req.sessao.usuario.id, dados.arquivoKey, dados.mimeType, dados.tamanhoBytes);
  }

  @Exige('editar_proprio_perfil')
  @Get('curriculos')
  listar(@Req() req: RequisicaoComSessao) {
    return this.curriculos.listar(req.sessao.usuario.id);
  }

  @Exige('editar_proprio_perfil')
  @Get('curriculos/:id')
  obterCurriculo(@Req() req: RequisicaoComSessao, @Param('id') id: string) {
    return this.curriculos.obter(req.sessao.usuario.id, id);
  }

  @Exige('editar_proprio_perfil')
  @HttpCode(200)
  @Post('curriculos/:id/confirmar')
  confirmar(@Req() req: RequisicaoComSessao, @Param('id') id: string, @Body() body: unknown) {
    const dados = validar(confirmarCurriculoSchema, body ?? {});
    return this.curriculos.confirmar(req.sessao.usuario.id, id, dados.dados as DadosCurriculo | undefined);
  }

  @Exige('editar_proprio_perfil')
  @HttpCode(200)
  @Post('lgpd/exportar')
  exportar(@Req() req: RequisicaoComSessao) {
    return this.lgpd.exportar(req.sessao.usuario.id);
  }

  @Exige('editar_proprio_perfil')
  @Sensivel()
  @HttpCode(200)
  @Post('lgpd/excluir')
  excluir(@Req() req: RequisicaoComSessao, @Body() body: unknown) {
    validar(excluirDadosSchema, body);
    return this.lgpd.excluir(req.sessao.usuario.id);
  }

  @Publico()
  @Put('interno/uploads/:token')
  async receberUpload(@Req() req: RequisicaoComSessao, @Param('token') token: string) {
    if (!(this.armazenamento instanceof ArmazenamentoMemoria)) {
      throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'upload interno indisponível');
    }
    const corpo = await lerCorpo(req as unknown as IncomingMessage);
    const resultado = this.armazenamento.receber(token, corpo);
    if (!resultado.ok) throw new ErroAplicacao(resultado.codigo, 400, 'upload inválido');
    return { ok: true };
  }

  @Publico()
  @Get('interno/curriculos/:id')
  meta(@Req() req: RequisicaoComSessao, @Param('id') id: string) {
    this.exigirInterno(req);
    return this.curriculos.metaInterna(id);
  }

  @Publico()
  @HttpCode(200)
  @Post('interno/curriculos/:id/resultado')
  resultado(@Req() req: RequisicaoComSessao, @Param('id') id: string, @Body() body: unknown) {
    this.exigirInterno(req);
    const dados = body as {
      metodoExtracao: 'NATIVO' | 'OCR' | 'MISTO' | null;
      confiancaOcr: number | null;
      textoExtraido: string;
      dados: DadosCurriculo;
      paginas: unknown;
    };
    return this.curriculos.salvarResultado(id, dados);
  }

  @Publico()
  @HttpCode(200)
  @Post('interno/curriculos/:id/falha')
  falha(@Req() req: RequisicaoComSessao, @Param('id') id: string) {
    this.exigirInterno(req);
    return this.curriculos.marcarFalha(id);
  }

  private exigirInterno(req: RequisicaoComSessao): void {
    if (!this.config.internalToken || cabecalho(req, 'x-internal-token') !== this.config.internalToken) {
      throw new ErroAplicacao('NAO_AUTENTICADO', 401, 'token interno inválido');
    }
  }
}
