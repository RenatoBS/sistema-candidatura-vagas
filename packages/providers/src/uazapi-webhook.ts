export interface MensagemWhatsappEntrada {
  mensagemIdProvedor: string;
  numeroRemetente: string;
  tipo: 'TEXTO' | 'AUDIO' | 'BOTAO' | 'MIDIA' | 'OUTRO';
  texto: string | null;
  botaoId: string | null;
  mimetype: string | null;
  duracaoSegundos: number | null;
  enviadaEm: Date | null;
  deMim: boolean;
  grupo: boolean;
  enviadaPelaApi: boolean;
}
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
export function normalizarWebhookUazapi(payload: unknown): MensagemWhatsappEntrada | null {
  const root = obj(payload);
  const message = obj(root.message);
  const content = obj(message.content);
  const id = str(message.messageid) ?? str(message.id) ?? str(root.messageid) ?? str(root.id);
  if (!id) return null;
  const sender = (str(message.sender) ?? str(root.sender) ?? str(message.chatid) ?? '').replace(
    /@s\.whatsapp\.net$/,
    '',
  );
  const kind = (str(message.messageType) ?? str(root.messageType) ?? '').toLowerCase();
  const tipo = kind.includes('audio')
    ? 'AUDIO'
    : kind.includes('button')
      ? 'BOTAO'
      : kind.includes('image') || kind.includes('video') || kind.includes('document')
        ? 'MIDIA'
        : kind.includes('conversation') ||
            kind.includes('text') ||
            str(message.text) ||
            str(message.content)
          ? 'TEXTO'
          : 'OUTRO';
  const timestamp = root.timestamp ?? message.timestamp;
  return {
    mensagemIdProvedor: id,
    numeroRemetente: sender.replace(/\D/g, ''),
    tipo,
    texto:
      kind.includes('extended') && (str(content.text) ?? str(message.content))
        ? (str(content.text) ?? str(message.content))
        : (str(message.text) ?? str(message.content) ?? str(root.text)),
    botaoId: str(message.buttonOrListid) ?? str(root.buttonOrListid),
    mimetype: str(content.mimetype) ?? str(message.mediaType),
    duracaoSegundos: typeof content.seconds === 'number' ? content.seconds : null,
    enviadaEm: typeof timestamp === 'number' ? new Date(timestamp * 1000) : null,
    deMim: message.fromMe === true || root.fromMe === true,
    grupo:
      message.isGroup === true ||
      root.isGroup === true ||
      (str(message.chatid) ?? str(root.chatid) ?? '').endsWith('@g.us'),
    enviadaPelaApi: message.wasSentByApi === true || root.wasSentByApi === true,
  };
}
