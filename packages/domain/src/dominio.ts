const DOMINIOS_GENERICOS = new Set([
  'gmail.com',
  'googlemail.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'yahoo.com',
  'yahoo.com.br',
  'icloud.com',
  'me.com',
  'proton.me',
  'protonmail.com',
  'uol.com.br',
  'bol.com.br',
  'terra.com.br',
  'globo.com',
]);

export function normalizarDominio(valor: string): string {
  return valor
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    .split('?')[0];
}

export function dominioDoEmail(email: string): string | null {
  const partes = email.trim().toLowerCase().split('@');
  if (partes.length !== 2 || !partes[0] || !partes[1]) return null;
  return partes[1];
}

export function ehDominioGenerico(dominio: string): boolean {
  return DOMINIOS_GENERICOS.has(normalizarDominio(dominio));
}

/** E-mail está no domínio declarado (apex ou subdomínio) e o domínio não é provedor genérico. */
export function emailConfirmaDominio(email: string, dominioDeclarado: string): boolean {
  const host = dominioDoEmail(email);
  const base = normalizarDominio(dominioDeclarado);
  if (!host || !base || ehDominioGenerico(base) || ehDominioGenerico(host)) return false;
  return host === base || host.endsWith(`.${base}`);
}

export function registroTxtEsperado(token: string): string {
  return `scv-verificacao=${token}`;
}

export function txtConfirmaDominio(registros: string[], token: string): boolean {
  const esperado = registroTxtEsperado(token).toLowerCase();
  return registros.some((registro) => registro.trim().toLowerCase() === esperado);
}
