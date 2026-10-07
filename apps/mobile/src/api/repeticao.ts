import { ErroApi } from './cliente';

export const MAX_REPETICOES = 2;

/** Erros 4xx não mudam com nova tentativa: falha logo para a tela mostrar o erro. */
export function deveRepetir(falhas: number, erro: unknown): boolean {
  if (erro instanceof ErroApi && erro.status >= 400 && erro.status < 500) return false;
  return falhas < MAX_REPETICOES;
}
