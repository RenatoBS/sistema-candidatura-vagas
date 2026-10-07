import type {
  ClienteInstanciaWhatsapp,
  ConexaoInstancia,
  InstanciaCriada,
  StatusInstanciaProvedor,
} from '@scv/providers';

/** Instância que nunca chama a Uazapi. O status já nasce conectado para a triagem poder começar. */
export class InstanciaSimulada implements ClienteInstanciaWhatsapp {
  private seq = 0;

  async init(nome: string): Promise<InstanciaCriada> {
    this.seq += 1;
    const slug = nome.replace(/\s+/g, '-').slice(0, 24) || 'empresa';
    return { id: `sim-${slug}-${this.seq}`, token: `sim-token-${this.seq}` };
  }

  async connect(): Promise<ConexaoInstancia> {
    return { qrcode: null, pairingCode: 'SIMULADOR' };
  }

  async status(): Promise<StatusInstanciaProvedor> {
    return { conectada: true, numero: '5511900001111' };
  }

  async disconnect(): Promise<void> {
    return undefined;
  }

  async configurarWebhook(): Promise<void> {
    return undefined;
  }
}
