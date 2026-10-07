/** Extrai o segredo base32 de uma URI `otpauth://` (null se ausente). */
export function segredoDaUri(uri: string): string | null {
  const consulta = uri.split('?')[1];
  if (!consulta) return null;
  for (const par of consulta.split('&')) {
    const [chave, valor] = par.split('=');
    if (chave === 'secret' && valor) return decodeURIComponent(valor).toUpperCase();
  }
  return null;
}

/** Agrupa o segredo de 4 em 4 caracteres para facilitar a digitação manual. */
export function segredoEmGrupos(segredo: string, tamanho = 4): string {
  const limpo = segredo.replace(/\s/g, '');
  const grupos: string[] = [];
  for (let i = 0; i < limpo.length; i += tamanho) grupos.push(limpo.slice(i, i + tamanho));
  return grupos.join(' ');
}
