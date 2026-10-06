export interface InstanciaCriada {
  id: string;
  token: string;
}

export interface ConexaoInstancia {
  qrcode: string | null;
  pairingCode: string | null;
}

export interface StatusInstanciaProvedor {
  conectada: boolean;
  numero: string | null;
}

export interface ClienteInstanciaWhatsapp {
  init(nome: string): Promise<InstanciaCriada>;
  connect(tokenInstancia: string): Promise<ConexaoInstancia>;
  status(tokenInstancia: string): Promise<StatusInstanciaProvedor>;
  disconnect(tokenInstancia: string): Promise<void>;
  configurarWebhook(tokenInstancia: string, url: string): Promise<void>;
}

type FetchLike = typeof fetch;

function texto(valor: unknown): string | null {
  return typeof valor === 'string' && valor.length > 0 ? valor : null;
}

function comoRegistro(valor: unknown): Record<string, unknown> {
  return valor && typeof valor === 'object' ? (valor as Record<string, unknown>) : {};
}

/**
 * Parte de instâncias da Uazapi, no padrão do sof:
 * header `admintoken` na administração e `token` da instância nas demais rotas.
 */
export class UazapiInstanciaCliente implements ClienteInstanciaWhatsapp {
  constructor(
    private readonly baseUrl: string,
    private readonly adminToken: string,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  private url(caminho: string): string {
    return `${this.baseUrl.replace(/\/$/, '')}${caminho}`;
  }

  private async requisicao(
    caminho: string,
    init: { method?: string; token?: string; admin?: boolean; body?: unknown },
  ): Promise<Record<string, unknown>> {
    if (!this.baseUrl || !this.adminToken) {
      throw new Error('UAZAPI_NAO_CONFIGURADA');
    }
    const headers: Record<string, string> = { accept: 'application/json' };
    if (init.body !== undefined) headers['content-type'] = 'application/json';
    if (init.admin) headers.admintoken = this.adminToken;
    if (init.token) headers.token = init.token;
    const resposta = await this.fetchImpl(this.url(caminho), {
      method: init.method ?? 'GET',
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
    if (!resposta.ok) {
      throw new Error(`UAZAPI_${resposta.status}`);
    }
    if (resposta.status === 204) return {};
    const json = (await resposta.json()) as unknown;
    return comoRegistro(json);
  }

  async init(nome: string): Promise<InstanciaCriada> {
    const corpo = await this.requisicao('/instance/init', {
      method: 'POST',
      admin: true,
      body: { name: nome },
    });
    const instancia = comoRegistro(corpo.instance);
    const id = texto(instancia.id) ?? texto(corpo.id) ?? texto(corpo.instanceId);
    const token = texto(corpo.token) ?? texto(instancia.token);
    if (!id || !token) throw new Error('UAZAPI_RESPOSTA_INVALIDA');
    return { id, token };
  }

  async connect(tokenInstancia: string): Promise<ConexaoInstancia> {
    const corpo = await this.requisicao('/instance/connect', {
      method: 'POST',
      token: tokenInstancia,
      body: {},
    });
    const instancia = comoRegistro(corpo.instance);
    return {
      qrcode: texto(corpo.qrcode) ?? texto(instancia.qrcode) ?? texto(corpo.base64),
      pairingCode: texto(corpo.paircode) ?? texto(instancia.paircode) ?? texto(corpo.pairingCode),
    };
  }

  async status(tokenInstancia: string): Promise<StatusInstanciaProvedor> {
    const corpo = await this.requisicao('/instance/status', { token: tokenInstancia });
    const instancia = comoRegistro(corpo.instance);
    const status = comoRegistro(corpo.status);
    const statusTexto = (texto(instancia.status) ?? texto(corpo.state) ?? '').toLowerCase();
    const conectada =
      status.connected === true ||
      corpo.connected === true ||
      statusTexto === 'connected' ||
      statusTexto === 'open';
    const numero =
      texto(instancia.owner) ??
      texto(instancia.number) ??
      texto(status.jid) ??
      texto(corpo.number);
    return { conectada, numero };
  }

  async disconnect(tokenInstancia: string): Promise<void> {
    await this.requisicao('/instance/disconnect', {
      method: 'POST',
      token: tokenInstancia,
      body: {},
    });
  }

  async configurarWebhook(tokenInstancia: string, url: string): Promise<void> {
    await this.requisicao('/webhook', {
      method: 'POST',
      token: tokenInstancia,
      body: {
        url,
        enabled: true,
        events: ['messages'],
        excludeMessages: ['wasSentByApi', 'isGroupYes'],
      },
    });
  }
}

export class FakeUazapiInstancia implements ClienteInstanciaWhatsapp {
  conectadas = new Set<string>();
  webhooks: Array<{ token: string; url: string }> = [];
  falharInit = false;

  async init(nome: string): Promise<InstanciaCriada> {
    if (this.falharInit) throw new Error('UAZAPI_INDISPONIVEL');
    return { id: `inst-${nome}`, token: `tok-${nome}` };
  }

  async connect(tokenInstancia: string): Promise<ConexaoInstancia> {
    return { qrcode: `qr:${tokenInstancia}`, pairingCode: 'ABCD-1234' };
  }

  async status(tokenInstancia: string): Promise<StatusInstanciaProvedor> {
    const conectada = this.conectadas.has(tokenInstancia);
    return { conectada, numero: conectada ? '5511999990000' : null };
  }

  async disconnect(tokenInstancia: string): Promise<void> {
    this.conectadas.delete(tokenInstancia);
  }

  async configurarWebhook(tokenInstancia: string, url: string): Promise<void> {
    this.webhooks.push({ token: tokenInstancia, url });
    this.conectadas.add(tokenInstancia);
  }

  limpar(): void {
    this.conectadas.clear();
    this.webhooks.length = 0;
    this.falharInit = false;
  }
}
