import { Controller, Get, Headers, Inject, Param, Post, Req, Body } from '@nestjs/common';

import type { SessaoRequest } from '../sessao';
import { WebhookUazapiService } from '../whatsapp/webhook-uazapi.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { Publico, Sensivel } from './decoradores';

interface RequisicaoComSessao {
  sessao: SessaoRequest;
}

@Controller()
export class WhatsappController {
  constructor(
    @Inject(WhatsappService) private readonly whatsapp: WhatsappService,
    @Inject(WebhookUazapiService) private readonly webhookService: WebhookUazapiService,
  ) {}

  @Post('empresas/:empresaId/whatsapp/instancia')
  criar(@Req() req: RequisicaoComSessao, @Param('empresaId') empresaId: string) {
    return this.whatsapp.criar(req.sessao, empresaId);
  }

  @Post('empresas/:empresaId/whatsapp/conectar')
  conectar(@Req() req: RequisicaoComSessao, @Param('empresaId') empresaId: string) {
    return this.whatsapp.conectar(req.sessao, empresaId);
  }

  @Get('empresas/:empresaId/whatsapp/status')
  status(@Req() req: RequisicaoComSessao, @Param('empresaId') empresaId: string) {
    return this.whatsapp.status(req.sessao, empresaId);
  }

  @Post('empresas/:empresaId/whatsapp/desconectar')
  @Sensivel()
  desconectar(@Req() req: RequisicaoComSessao, @Param('empresaId') empresaId: string) {
    return this.whatsapp.desconectar(req.sessao, empresaId);
  }

  @Get('admin/whatsapp/instancias')
  listar(@Req() req: RequisicaoComSessao) {
    return this.whatsapp.listarAdmin(req.sessao);
  }

  @Publico()
  @Post('webhooks/whatsapp/uazapi/:instanciaId')
  async webhook(
    @Param('instanciaId') instanciaId: string,
    @Headers('x-webhook-secret') segredo: string | undefined,
    @Body() payload: unknown,
  ) {
    return this.webhookService.receber(instanciaId, segredo, payload);
  }
}
