import { Body, Controller, Get, HttpCode, Inject, Param, Post, Put, Query, Req } from '@nestjs/common';
import { preferenciasNotificacaoSchema } from '@scv/contracts';

import type { ConfiguracaoApp } from '../configuracao';
import { ErroAplicacao } from '../erros';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import type { SessaoRequest } from '../sessao';
import { CONFIG } from '../tokens';
import { Publico } from './decoradores';
import { validar } from './validar';

interface RequisicaoComSessao {
  sessao: SessaoRequest;
  headers: Record<string, string | string[] | undefined>;
}

/** Central in-app: cada usuário só enxerga as próprias notificações (sem `@Exige`, basta a sessão). */
@Controller()
export class NotificacoesController {
  constructor(
    @Inject(NotificacoesService) private readonly notificacoes: NotificacoesService,
    @Inject(CONFIG) private readonly config: ConfiguracaoApp,
  ) {}

  @Get('notificacoes')
  listar(@Req() req: RequisicaoComSessao, @Query() consulta: Record<string, unknown>) {
    return this.notificacoes.listar(req.sessao, consulta);
  }

  @Get('notificacoes/preferencias')
  preferencias(@Req() req: RequisicaoComSessao) {
    return this.notificacoes.preferencias(req.sessao);
  }

  @Put('notificacoes/preferencias')
  salvarPreferencias(@Req() req: RequisicaoComSessao, @Body() body: unknown) {
    return this.notificacoes.salvarPreferencias(req.sessao, validar(preferenciasNotificacaoSchema, body).itens);
  }

  @HttpCode(200)
  @Post('notificacoes/lidas')
  marcarTodasLidas(@Req() req: RequisicaoComSessao) {
    return this.notificacoes.marcarTodasLidas(req.sessao);
  }

  @HttpCode(200)
  @Post('notificacoes/:id/lida')
  marcarLida(@Req() req: RequisicaoComSessao, @Param('id') id: string) {
    return this.notificacoes.marcarLida(req.sessao, id);
  }

  @Publico()
  @HttpCode(200)
  @Post('interno/notificacoes/match-forte/:sugestaoId')
  matchForte(@Req() req: RequisicaoComSessao, @Param('sugestaoId') sugestaoId: string) {
    const token = req.headers['x-internal-token'];
    if (!this.config.internalToken || token !== this.config.internalToken) {
      throw new ErroAplicacao('NAO_AUTENTICADO', 401, 'token interno inválido');
    }
    return this.notificacoes.matchForte(sugestaoId);
  }
}
