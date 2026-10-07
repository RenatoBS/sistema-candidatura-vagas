import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Put, Query, Req } from '@nestjs/common';
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

  @Post('dispositivos-push')
  registrarDispositivo(@Req() req: RequisicaoComSessao, @Body() body: { token?: string; plataforma?: 'IOS' | 'ANDROID' | 'WEB' }) {
    if (!body.token || !body.plataforma) throw new ErroAplicacao('DADOS_INVALIDOS', 400, 'token e plataforma são obrigatórios');
    return this.notificacoes.registrarDispositivo(req.sessao, body.token, body.plataforma);
  }

  @Delete('dispositivos-push/:token')
  removerDispositivo(@Req() req: RequisicaoComSessao, @Param('token') token: string) { return this.notificacoes.removerDispositivo(req.sessao, token); }

  @Publico()
  @Post('interno/dispositivos-push/limpeza')
  limparDispositivos(@Req() req: RequisicaoComSessao) {
    const token = req.headers['x-internal-token'];
    if (!this.config.internalToken || token !== this.config.internalToken) throw new ErroAplicacao('NAO_AUTENTICADO', 401, 'token interno inválido');
    const dias = Number(process.env.PUSH_TOKEN_RETENCAO_DIAS ?? 90);
    if (!Number.isInteger(dias) || dias < 1) throw new ErroAplicacao('DADOS_INVALIDOS', 400, 'PUSH_TOKEN_RETENCAO_DIAS inválido');
    return this.notificacoes.limparDispositivosInativos(dias);
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
