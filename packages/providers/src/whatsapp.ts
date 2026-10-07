export type TipoMidiaWhatsapp = 'audio' | 'image' | 'document' | 'video';
export interface EnvioWhatsapp {
  mensagemIdProvedor: string;
}
export interface MensagemWhatsapp {
  numero: string;
  texto: string;
  atrasoMs?: number;
}
export interface EscolhaWhatsapp {
  id: string;
  titulo: string;
}
export interface MidiaWhatsapp {
  numero: string;
  tipo: TipoMidiaWhatsapp;
  arquivo: string;
  legenda?: string;
}
export interface DownloadMidiaWhatsapp {
  url?: string;
  base64?: string;
  mimetype: string | null;
}
export async function baixarConteudoMidia(
  midia: DownloadMidiaWhatsapp,
  fetchImpl: FetchLike = fetch,
  limiteBytes = 16 * 1024 * 1024,
): Promise<Buffer> {
  if (midia.mimetype && !midia.mimetype.toLowerCase().startsWith('audio/'))
    throw new Error('AUDIO_MIMETYPE_INVALIDO');
  if (midia.base64) {
    const bytes = Buffer.from(midia.base64, 'base64');
    if (bytes.length > limiteBytes) throw new Error('AUDIO_MUITO_GRANDE');
    return bytes;
  }
  if (!midia.url) throw new Error('AUDIO_NAO_ENCONTRADO');
  const resposta = await fetchImpl(midia.url);
  if (!resposta.ok) throw new Error(`UAZAPI_${resposta.status}`);
  const tamanho = Number(resposta.headers.get('content-length') ?? 0);
  if (tamanho > limiteBytes) throw new Error('AUDIO_MUITO_GRANDE');
  const bytes = Buffer.from(await resposta.arrayBuffer());
  if (bytes.length > limiteBytes) throw new Error('AUDIO_MUITO_GRANDE');
  return bytes;
}
export interface WhatsappProvider {
  enviarTexto(entrada: {
    token: string;
    numero: string;
    texto: string;
    atrasoMs?: number;
  }): Promise<EnvioWhatsapp>;
  enviarMenu(entrada: {
    token: string;
    numero: string;
    texto: string;
    opcoes: EscolhaWhatsapp[];
    rodape?: string;
  }): Promise<EnvioWhatsapp>;
  enviarMidia(entrada: {
    token: string;
    numero: string;
    tipo: TipoMidiaWhatsapp;
    arquivo: string;
    legenda?: string;
  }): Promise<EnvioWhatsapp>;
  baixarMidia(entrada: {
    token: string;
    mensagemId: string;
    gerarLink?: boolean;
  }): Promise<DownloadMidiaWhatsapp>;
}

type FetchLike = typeof fetch;
const registro = (valor: unknown): Record<string, unknown> =>
  valor && typeof valor === 'object' ? (valor as Record<string, unknown>) : {};
const texto = (valor: unknown): string | undefined =>
  typeof valor === 'string' && valor ? valor : undefined;
function idDaResposta(valor: Record<string, unknown>): string {
  const chave = registro(valor.key);
  const message = registro(valor.message);
  const id = texto(valor.messageid) ?? texto(valor.id) ?? texto(chave.id) ?? texto(message.id);
  if (!id) throw new Error('UAZAPI_RESPOSTA_INVALIDA');
  return id;
}

export class UazapiProvider implements WhatsappProvider {
  constructor(
    private readonly baseUrl: string,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}
  private async requisicao(
    caminho: string,
    token: string,
    body: unknown,
  ): Promise<Record<string, unknown>> {
    const resposta = await this.fetchImpl(`${this.baseUrl.replace(/\/$/, '')}${caminho}`, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json', token },
      body: JSON.stringify(body),
    });
    if (!resposta.ok) throw new Error(`UAZAPI_${resposta.status}`);
    return registro(await resposta.json());
  }
  async enviarTexto(e: {
    token: string;
    numero: string;
    texto: string;
    atrasoMs?: number;
  }): Promise<EnvioWhatsapp> {
    return {
      mensagemIdProvedor: idDaResposta(
        await this.requisicao('/send/text', e.token, {
          number: e.numero,
          text: e.texto,
          ...(e.atrasoMs === undefined ? {} : { delay: e.atrasoMs }),
        }),
      ),
    };
  }
  async enviarMenu(e: {
    token: string;
    numero: string;
    texto: string;
    opcoes: EscolhaWhatsapp[];
    rodape?: string;
  }): Promise<EnvioWhatsapp> {
    const fallback = e.opcoes.map((opcao, indice) => `${indice + 1} - ${opcao.titulo}`).join('\n');
    const corpo = {
      number: e.numero,
      type: 'button',
      text: `${e.texto}\n\n${fallback}`,
      choices: e.opcoes.map((opcao) => `${opcao.titulo}|${opcao.id}`),
      ...(e.rodape ? { footerText: e.rodape } : {}),
    };
    return {
      mensagemIdProvedor: idDaResposta(await this.requisicao('/send/menu', e.token, corpo)),
    };
  }
  async enviarMidia(e: {
    token: string;
    numero: string;
    tipo: TipoMidiaWhatsapp;
    arquivo: string;
    legenda?: string;
  }): Promise<EnvioWhatsapp> {
    return {
      mensagemIdProvedor: idDaResposta(
        await this.requisicao('/send/media', e.token, {
          number: e.numero,
          type: e.tipo,
          file: e.arquivo,
          ...(e.legenda ? { text: e.legenda } : {}),
        }),
      ),
    };
  }
  async baixarMidia(e: {
    token: string;
    mensagemId: string;
    gerarLink?: boolean;
  }): Promise<DownloadMidiaWhatsapp> {
    const corpo = registro(
      await this.requisicao('/message/download', e.token, {
        id: e.mensagemId,
        return_link: e.gerarLink ?? true,
        generate_mp3: false,
      }),
    );
    return {
      url: texto(corpo.fileURL) ?? texto(corpo.url),
      base64: texto(corpo.base64Data) ?? texto(corpo.base64),
      mimetype: texto(corpo.mimetype) ?? null,
    };
  }
  async baixarBuffer(url: string): Promise<Buffer> {
    const resposta = await this.fetchImpl(url);
    if (!resposta.ok) throw new Error(`UAZAPI_${resposta.status}`);
    return Buffer.from(await resposta.arrayBuffer());
  }
}

export class FakeWhatsappProvider implements WhatsappProvider {
  enviados: Array<Record<string, unknown>> = [];
  private midias = new Map<string, DownloadMidiaWhatsapp>();
  falhar = false;
  async enviarTexto(e: {
    token: string;
    numero: string;
    texto: string;
    atrasoMs?: number;
  }): Promise<EnvioWhatsapp> {
    return this.registrar('texto', e);
  }
  async enviarMenu(e: {
    token: string;
    numero: string;
    texto: string;
    opcoes: EscolhaWhatsapp[];
    rodape?: string;
  }): Promise<EnvioWhatsapp> {
    return this.registrar('menu', e);
  }
  async enviarMidia(e: {
    token: string;
    numero: string;
    tipo: TipoMidiaWhatsapp;
    arquivo: string;
    legenda?: string;
  }): Promise<EnvioWhatsapp> {
    return this.registrar('midia', e);
  }
  async baixarMidia(e: { token: string; mensagemId: string }): Promise<DownloadMidiaWhatsapp> {
    if (this.falhar) throw new Error('UAZAPI_FALHA_FAKE');
    return this.midias.get(e.mensagemId) ?? { mimetype: null };
  }
  programarMidia(id: string, midia: DownloadMidiaWhatsapp): void {
    this.midias.set(id, midia);
  }
  limpar(): void {
    this.enviados.length = 0;
    this.midias.clear();
    this.falhar = false;
  }
  private registrar(tipo: string, valor: Record<string, unknown>): EnvioWhatsapp {
    if (this.falhar) throw new Error('UAZAPI_FALHA_FAKE');
    const id = `fake-${this.enviados.length + 1}`;
    this.enviados.push({ tipo, ...valor, mensagemIdProvedor: id });
    return { mensagemIdProvedor: id };
  }
}
