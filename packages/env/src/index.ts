/** `process.env` ou qualquer objeto com variáveis opcionais (interfaces sem index signature também servem). */
export type Ambiente = object;

function ler(env: Ambiente, nome: string): string | undefined {
  const valor = (env as Record<string, unknown>)[nome];
  return typeof valor === 'string' ? valor.trim() : undefined;
}

/**
 * Valor da variável de ambiente, ou `padrao` quando ausente **ou vazia/só espaços**.
 * `env.X ?? 'padrao'` não protege contra `X=` no `.env`: a string vazia passa e quebra o default.
 */
export function envOu(env: Ambiente, nome: string, padrao: string): string {
  const valor = ler(env, nome);
  return valor ? valor : padrao;
}

/** Como `envOu`, mas devolve `undefined` quando ausente ou vazia. */
export function envOpcional(env: Ambiente, nome: string): string | undefined {
  const valor = ler(env, nome);
  return valor ? valor : undefined;
}

/** Número da variável (ausente/vazia → `padrao`); valor que não é número finito lança erro explícito. */
export function envNumero(env: Ambiente, nome: string, padrao: number): number {
  const bruto = envOpcional(env, nome);
  if (bruto === undefined) return padrao;
  const numero = Number(bruto);
  if (!Number.isFinite(numero)) throw new Error(`${nome} deve ser um número`);
  return numero;
}
