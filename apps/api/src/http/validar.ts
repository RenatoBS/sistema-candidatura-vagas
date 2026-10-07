import type { ZodType } from 'zod';

import { ErroAplicacao } from '../erros';

/** Valida com Zod; o 400 informa os campos inválidos (`detalhes.campos`), nunca os valores enviados. */
export function validar<T>(schema: ZodType<T>, valor: unknown): T {
  const resultado = schema.safeParse(valor);
  if (!resultado.success) {
    const campos = [...new Set(resultado.error.issues.map((item) => item.path.join('.') || '(corpo)'))];
    throw new ErroAplicacao('DADOS_INVALIDOS', 400, 'dados inválidos', { campos });
  }
  return resultado.data;
}
