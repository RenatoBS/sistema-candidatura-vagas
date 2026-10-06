const CHAVES_RANKING = new Set(['score', 'posicao', 'percentil', 'compatibilidade', 'embedding', 'ranking']);

export function contemRanking(valor: unknown): boolean {
  if (!valor || typeof valor !== 'object') return false;
  if (Array.isArray(valor)) return valor.some((item) => contemRanking(item));
  return Object.entries(valor as Record<string, unknown>).some(
    ([chave, item]) => CHAVES_RANKING.has(chave) || contemRanking(item),
  );
}

export const NOME_TITULAR_EXCLUIDO = 'Titular excluído';

export function emailAnonimizado(usuarioId: string): string {
  return `excluido-${usuarioId.replace(/-/g, '').slice(0, 12)}@anon.invalid`;
}
