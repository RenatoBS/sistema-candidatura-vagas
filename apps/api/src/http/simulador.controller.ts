import { Body, Controller, Get, Inject, Post, Query } from '@nestjs/common';

import { SimuladorEntrevistaService } from '../simulador/simulador-entrevista.service';
import { Publico } from './decoradores';

/** Rotas só existem quando SIMULADOR_ENTREVISTA está ligado. Não chamam Uazapi nem OpenAI. */
@Controller()
export class SimuladorController {
  constructor(@Inject(SimuladorEntrevistaService) private readonly simulador: SimuladorEntrevistaService) {}

  @Publico()
  @Get('dev/simulador/status')
  status() {
    return { ativo: true };
  }

  @Publico()
  @Get('dev/simulador/conversa')
  conversa(@Query('numero') numero: string | undefined) {
    return this.simulador.conversa(numero ?? '');
  }

  @Publico()
  @Post('dev/simulador/preparar')
  preparar(@Body() body: { numero?: string }) {
    return this.simulador.preparar(body?.numero ?? '');
  }

  @Publico()
  @Post('dev/simulador/entrada')
  entrada(@Body() body: { numero?: string; texto?: string; botaoId?: string }) {
    return this.simulador.entrada({
      numero: body?.numero ?? '',
      texto: body?.texto ?? '',
      botaoId: body?.botaoId,
    });
  }
}
