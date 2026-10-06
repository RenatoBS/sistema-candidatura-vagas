import { Controller, Get, Inject, Param, Post, Req } from '@nestjs/common';

import type { SessaoRequest } from '../sessao';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { Publico, Sensivel } from './decoradores';

interface RequisicaoComSessao {
  sessao: SessaoRequest;
}

@Controller()
export class WhatsappController {
  constructor(@Inject(WhatsappService) private readonly whatsapp: WhatsappService) {}

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
  webhook(@Param('instanciaId') instanciaId: string) {
    return { recebido: true, instanciaId };
  }
}
