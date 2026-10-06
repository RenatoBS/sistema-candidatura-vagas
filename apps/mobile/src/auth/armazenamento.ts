const memoria = new Map<string, string>();

function temLocalStorage(): boolean {
  return typeof globalThis.localStorage !== 'undefined';
}

export const armazenamento = {
  ler(chave: string): string | null {
    if (temLocalStorage()) return globalThis.localStorage.getItem(chave);
    return memoria.get(chave) ?? null;
  },
  gravar(chave: string, valor: string): void {
    if (temLocalStorage()) globalThis.localStorage.setItem(chave, valor);
    else memoria.set(chave, valor);
  },
  apagar(chave: string): void {
    if (temLocalStorage()) globalThis.localStorage.removeItem(chave);
    else memoria.delete(chave);
  },
};
