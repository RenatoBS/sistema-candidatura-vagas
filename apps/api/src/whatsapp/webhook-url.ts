/**
 * URL pública que a Uazapi chama. O segredo vai na query porque a Uazapi não expõe header customizado
 * no registro do webhook (ADR 0010); o servidor compara em tempo constante e o log mascara o parâmetro.
 */
export function urlWebhookUazapi(apiPublicUrl: string, instanciaId: string, segredo: string): string {
  const base = apiPublicUrl.replace(/\/+$/, '');
  return `${base}/api/v1/webhooks/whatsapp/uazapi/${encodeURIComponent(instanciaId)}?segredo=${encodeURIComponent(segredo)}`;
}
