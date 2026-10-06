import type { ZodType } from 'zod';

import { ErroAplicacao } from '../erros';

export function validar<T>(schema: ZodType<T>, valor: unknown): T {
  const resultado = schema.safeParse(valor);
  if (!resultado.success) {
    throw new ErroAplicacao('DADOS_INVALIDOS', 400, 'dados inválidos');
  }
  return resultado.data;
}
