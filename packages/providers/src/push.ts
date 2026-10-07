export interface PushMessage {
  token: string;
  titulo: string;
  corpo: string;
  dados?: Record<string, unknown>;
}

export class DeviceNotRegisteredError extends Error {
  constructor(readonly token: string) {
    super('DeviceNotRegistered');
    this.name = 'DeviceNotRegisteredError';
  }
}

export interface PushProvider {
  enviar(mensagem: PushMessage): Promise<void>;
}

export class MockPushProvider implements PushProvider {
  readonly enviados: PushMessage[] = [];
  async enviar(mensagem: PushMessage): Promise<void> {
    this.enviados.push({ ...mensagem, dados: mensagem.dados ? { ...mensagem.dados } : undefined });
  }
  limpar(): void { this.enviados.length = 0; }
}

export class ExpoPushProvider implements PushProvider {
  constructor(private readonly token?: string, private readonly fetcher: typeof fetch = fetch) {}

  async enviar(mensagem: PushMessage): Promise<void> {
    const resposta = await this.fetcher('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(this.token ? { authorization: `Bearer ${this.token}` } : {}) },
      body: JSON.stringify({ to: mensagem.token, title: mensagem.titulo, body: mensagem.corpo, data: mensagem.dados }),
    });
    if (!resposta.ok) throw new Error(`Expo Push HTTP ${resposta.status}`);
    const corpo = await resposta.json() as { data?: { status?: string; details?: { error?: string } } };
    if (corpo.data?.details?.error === 'DeviceNotRegistered') throw new DeviceNotRegisteredError(mensagem.token);
  }
}

export function criarPushProvider(env: NodeJS.ProcessEnv = process.env): PushProvider {
  return env.PUSH_PROVIDER === 'expo' || Boolean(env.EXPO_ACCESS_TOKEN)
    ? new ExpoPushProvider(env.EXPO_ACCESS_TOKEN)
    : new MockPushProvider();
}
