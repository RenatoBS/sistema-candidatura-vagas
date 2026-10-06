/**
 * Validação de formato do LinkedIn. Não faz chamada de rede.
 * Formato aceito: https://www.linkedin.com/in/{slug} ou https://linkedin.com/in/{slug}.
 */

const LINKEDIN_PERFIL = /^https:\/\/(www\.)?linkedin\.com\/in\/[A-Za-z0-9\-_%]{3,100}\/?$/;

export type LeituraLinkedin = { ok: true; url: string | null } | { ok: false; codigo: 'LINKEDIN_INVALIDO' };

export function interpretarLinkedinUrl(valor: string | null | undefined): LeituraLinkedin {
  if (valor === null || valor === undefined || valor.trim() === '') return { ok: true, url: null };
  const url = valor.trim();
  if (!LINKEDIN_PERFIL.test(url)) return { ok: false, codigo: 'LINKEDIN_INVALIDO' };
  return { ok: true, url: url.replace(/\/$/, '') };
}
