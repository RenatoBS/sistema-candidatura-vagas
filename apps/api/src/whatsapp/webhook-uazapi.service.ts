import { timingSafeEqual, randomUUID } from 'node:crypto';
import { Injectable, Inject } from '@nestjs/common';
import { decifrar, normalizarWebhookUazapi } from '@scv/providers';
import type { ConfiguracaoApp } from '../configuracao';
import { ErroAplicacao } from '../erros';
import type { DeduplicadorWebhook, FilaWhatsappEntrada } from '../fila/fila-whatsapp-entrada';
import type { Repositorio } from '../repositorio/tipos';
import { CONFIG, DEDUPLICADOR_WEBHOOK, FILA_WHATSAPP_ENTRADA, REPOSITORIO } from '../tokens';

@Injectable()
export class WebhookUazapiService {
  constructor(
    @Inject(REPOSITORIO) private readonly repo: Repositorio,
    @Inject(CONFIG) private readonly config: ConfiguracaoApp,
    @Inject(DEDUPLICADOR_WEBHOOK) private readonly deduplicador: DeduplicadorWebhook,
    @Inject(FILA_WHATSAPP_ENTRADA) private readonly fila: FilaWhatsappEntrada,
  ) {}

  async receber(instanciaId: string, segredo: string | undefined, payload: unknown) {
    this.validarSegredo(segredo);
    const instancia = await this.repo.buscarInstanciaPorId(instanciaId, { sistema: true });
    if (!instancia)
      throw new ErroAplicacao('INSTANCIA_NAO_ENCONTRADA', 404, 'instância não encontrada');
    if (!payload || typeof payload !== 'object' || Array.isArray(payload))
      return { status: 'ignorado', motivo: 'payload_invalido' };
    const recebido = payload as Record<string, unknown>;
    if (typeof recebido.token === 'string') {
      const token = decifrar(instancia.tokenCifrado, this.config.encryptionKey);
      if (!segredosIguais(recebido.token, token))
        throw new ErroAplicacao('WEBHOOK_NAO_AUTORIZADO', 401, 'webhook não autorizado');
    }
    const mensagem = normalizarWebhookUazapi(payload);
    if (!mensagem) return { status: 'ignorado', motivo: 'evento_sem_mensagem' };
    if (mensagem.deMim) return { status: 'ignorado', motivo: 'from_me' };
    if (mensagem.enviadaPelaApi) return { status: 'ignorado', motivo: 'api' };
    if (mensagem.grupo) return { status: 'ignorado', motivo: 'grupo' };
    const chave = `${instancia.id}:${mensagem.mensagemIdProvedor}`;
    try {
      await this.deduplicador.registrar(chave);
    } catch {
      // O índice único do banco continua sendo a fonte de verdade.
    }
    const evento = await this.repo.registrarEventoWhatsappEntrada(
      {
        id: randomUUID(),
        empresaId: instancia.empresaId,
        instanciaWhatsappId: instancia.id,
        mensagemIdProvedor: mensagem.mensagemIdProvedor,
        tipo: mensagem.tipo,
        payloadNormalizado: mensagem as unknown as Record<string, unknown>,
        status: 'RECEBIDO',
        criadoEm: new Date(),
      },
      { sistema: true },
    );
    if (!evento) return { status: 'duplicado' };
    await this.fila.enfileirar(
      {
        eventoId: evento.id,
        empresaId: evento.empresaId,
        instanciaId: evento.instanciaWhatsappId,
        mensagem,
      },
      chave,
    );
    return { status: 'recebido', eventoId: evento.id };
  }

  private validarSegredo(segredo: string | undefined): void {
    if (
      !this.config.uazapiWebhookSecret ||
      !segredo ||
      !segredosIguais(segredo, this.config.uazapiWebhookSecret)
    )
      throw new ErroAplicacao('WEBHOOK_NAO_AUTORIZADO', 401, 'webhook não autorizado');
  }
}

function segredosIguais(a: string, b: string): boolean {
  const esquerda = Buffer.from(a);
  const direita = Buffer.from(b);
  return esquerda.length === direita.length && timingSafeEqual(esquerda, direita);
}
