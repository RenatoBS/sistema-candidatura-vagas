import { Inject, Injectable } from '@nestjs/common';
import { atrasoHumanoMs, consentimentosVigentes, podeEnviarWhatsapp, type MotivoRecusaEnvio } from '@scv/domain';
import { decifrar, type WhatsappProvider } from '@scv/providers';

import type { Relogio } from '../auth/auth.service';
import type { ConfiguracaoApp } from '../configuracao';
import type { Repositorio } from '../repositorio/tipos';
import { ALEATORIO, CONFIG, LIMITADOR_ENVIO, RELOGIO, REPOSITORIO, WHATSAPP_MENSAGENS } from '../tokens';
import type { LimitadorEnvio } from './limitador-envio';

export interface PedidoEnvioWhatsapp {
  empresaId: string;
  candidatoId: string;
  numero: string | null;
  texto: string;
  opcoes?: Array<{ id: string; titulo: string }>;
  excecaoOptOut?: boolean;
}

export type ResultadoEnvio =
  | { ok: true; mensagemId: string }
  | { ok: false; motivo: MotivoRecusaEnvio; esperaMs?: number };

@Injectable()
export class EnviadorWhatsapp {
  constructor(
    @Inject(REPOSITORIO) private readonly repo: Repositorio,
    @Inject(WHATSAPP_MENSAGENS) private readonly whatsapp: WhatsappProvider,
    @Inject(LIMITADOR_ENVIO) private readonly limitador: LimitadorEnvio,
    @Inject(CONFIG) private readonly config: ConfiguracaoApp,
    @Inject(RELOGIO) private readonly relogio: Relogio,
    @Inject(ALEATORIO) private readonly aleatorio: () => number,
  ) {}

  async enviar(pedido: PedidoEnvioWhatsapp): Promise<ResultadoEnvio> {
    const instancia = await this.repo.buscarInstanciaPorEmpresa(pedido.empresaId, { sistema: true });
    const consentimentos = consentimentosVigentes(
      await this.repo.listarConsentimentos(pedido.candidatoId),
    );
    const guarda = podeEnviarWhatsapp({
      optInWhatsapp: consentimentos.some((item) => item.tipo === 'WHATSAPP' && item.concedido),
      optInAudio: consentimentos.some((item) => item.tipo === 'AUDIO_WHATSAPP' && item.concedido),
      instanciaConectada: instancia?.status === 'CONECTADA',
      numero: pedido.numero,
      excecaoOptOut: pedido.excecaoOptOut,
    });
    if (!guarda.ok || !instancia || !pedido.numero) return guarda.ok ? { ok: false, motivo: 'NUMERO_AUSENTE' } : guarda;
    const limite = await this.limitador.consumir(instancia.id, this.relogio.agora());
    if (!limite.permitido) return { ok: false, motivo: 'RATE_LIMIT', esperaMs: limite.esperaMs };
    const token = decifrar(instancia.tokenCifrado, this.config.encryptionKey);
    const atrasoMs = atrasoHumanoMs(this.aleatorio);
    const envio = pedido.opcoes?.length
      ? await this.whatsapp.enviarMenu({
          token,
          numero: pedido.numero,
          texto: pedido.texto,
          opcoes: pedido.opcoes,
          atrasoMs,
        })
      : await this.whatsapp.enviarTexto({ token, numero: pedido.numero, texto: pedido.texto, atrasoMs });
    return { ok: true, mensagemId: envio.mensagemIdProvedor };
  }
}
