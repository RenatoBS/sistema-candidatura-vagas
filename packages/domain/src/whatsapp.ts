export type LeituraWhatsapp = { ok: true; numero: string | null } | { ok: false; codigo: 'WHATSAPP_INVALIDO' };

/** Só o formato E.164. A verificação do número fica para a fase do WhatsApp. */
export function interpretarWhatsapp(valor: string | null | undefined): LeituraWhatsapp {
  if (valor === null || valor === undefined || valor.trim() === '') return { ok: true, numero: null };
  const digitos = valor.replace(/\D/g, '');
  if (digitos.length < 10 || digitos.length > 15) return { ok: false, codigo: 'WHATSAPP_INVALIDO' };
  return { ok: true, numero: `+${digitos}` };
}
