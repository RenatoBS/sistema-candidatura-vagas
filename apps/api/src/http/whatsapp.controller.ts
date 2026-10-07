import { timingSafeEqual } from 'node:crypto';
import { Controller, Get, Headers, Inject, Param, Post, Req, Body } from '@nestjs/common';
import { normalizarWebhookUazapi, decifrar } from '@scv/providers';

import type { ConfiguracaoApp } from '../configuracao';
import { ErroAplicacao } from '../erros';
import type { FilaWhatsappEntrada } from '../fila/fila-whatsapp-entrada';
import type { Repositorio } from '../repositorio/tipos';
import type { SessaoRequest } from '../sessao';
import { FILA_WHATSAPP_ENTRADA, REPOSITORIO, CONFIG } from '../tokens';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { Publico, Sensivel } from './decoradores';

interface RequisicaoComSessao {
  sessao: SessaoRequest;
}

@Controller()
export class WhatsappController {
  private readonly dedup = new Set<string>();
  constructor(
    @Inject(WhatsappService) private readonly whatsapp: WhatsappService,
    @Inject(REPOSITORIO) private readonly repo: Repositorio,
    @Inject(CONFIG) private readonly config: ConfiguracaoApp,
    @Inject(FILA_WHATSAPP_ENTRADA) private readonly fila: FilaWhatsappEntrada,
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
    if (
      !this.config.uazapiWebhookSecret ||
      !segredo ||
      !segredosIguais(segredo, this.config.uazapiWebhookSecret)
    )
      throw new ErroAplicacao('WEBHOOK_NAO_AUTORIZADO', 401, 'webhook não autorizado');
    const instancia = (await this.repo.listarInstancias({ sistema: true })).find(
      (item) => item.id === instanciaId,
    );
    if (!instancia)
      throw new ErroAplicacao('INSTANCIA_NAO_ENCONTRADA', 404, 'instância não encontrada');
    const recebido = payload as Record<string, unknown>;
    const token = typeof recebido.token === 'string' ? recebido.token : undefined;
    if (token) {
      let tokenReal = '';
      try {
        tokenReal = decifrar(instancia.tokenCifrado, this.config.encryptionKey);
      } catch {
        throw new ErroAplicacao('WEBHOOK_NAO_AUTORIZADO', 401, 'webhook não autorizado');
      }
      if (!segredosIguais(token, tokenReal))
        throw new ErroAplicacao('WEBHOOK_NAO_AUTORIZADO', 401, 'webhook não autorizado');
    }
    const mensagem = normalizarWebhookUazapi(payload);
    if (!mensagem) return { status: 'ignorado', motivo: 'evento_sem_mensagem' };
    if (mensagem.deMim) return { status: 'ignorado', motivo: 'from_me' };
    if (mensagem.enviadaPelaApi) return { status: 'ignorado', motivo: 'api' };
    if (mensagem.grupo) return { status: 'ignorado', motivo: 'grupo' };
    const chave = `${instancia.id}:${mensagem.mensagemIdProvedor}`;
    if (this.dedup.has(chave)) return { status: 'duplicado' };
    this.dedup.add(chave);
    const eventoId = `evento-${mensagem.mensagemIdProvedor}`;
    await this.fila.enfileirar(
      { eventoId, empresaId: instancia.empresaId, instanciaId: instancia.id, mensagem },
      chave,
    );
    return { status: 'recebido', eventoId };
  }
}

function segredosIguais(a: string, b: string): boolean {
  const esquerda = Buffer.from(a);
  const direita = Buffer.from(b);
  return esquerda.length === direita.length && timingSafeEqual(esquerda, direita);
}
