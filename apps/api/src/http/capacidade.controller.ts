import { Controller, Get, Headers, HttpCode, Inject } from '@nestjs/common';

import { CapacidadeService } from '../capacidade/capacidade.service';
import type { ConfiguracaoApp } from '../configuracao';
import { ErroAplicacao } from '../erros';
import { CONFIG } from '../tokens';
import { Publico } from './decoradores';

@Controller()
export class CapacidadeController {
  constructor(
    @Inject(CapacidadeService) private readonly capacidade: CapacidadeService,
    @Inject(CONFIG) private readonly config: ConfiguracaoApp,
  ) {}

  @Publico()
  @HttpCode(200)
  @Get('interno/capacidade')
  painel(@Headers('x-internal-token') token: string | undefined) {
    if (!this.config.internalToken || token !== this.config.internalToken) {
      throw new ErroAplicacao('NAO_AUTENTICADO', 401, 'token interno inválido');
    }
    return this.capacidade.painel();
  }
}
