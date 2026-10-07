// Brasília não tem horário de verão desde 2019; o deslocamento fixo evita depender do suporte a
// Intl/timeZone do Hermes, que varia entre plataformas.
const DESLOCAMENTO_BRASILIA_MS = -3 * 60 * 60 * 1000;

function doisDigitos(valor: number): string {
  return String(valor).padStart(2, '0');
}

/** Formata um instante ISO como `dd/mm/aaaa hh:mm` no horário de Brasília (America/Sao_Paulo). */
export function formatarDataHora(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const instante = new Date(iso);
  if (Number.isNaN(instante.getTime())) return null;
  const local = new Date(instante.getTime() + DESLOCAMENTO_BRASILIA_MS);
  const data = `${doisDigitos(local.getUTCDate())}/${doisDigitos(local.getUTCMonth() + 1)}/${local.getUTCFullYear()}`;
  return `${data} ${doisDigitos(local.getUTCHours())}:${doisDigitos(local.getUTCMinutes())}`;
}
