import { relogioTeste } from '../src/ambiente-teste';
import { codigoTotp } from '../src/auth/segredos';

/**
 * Um código TOTP só vale uma vez (FC-15): cada chamada avança o relógio de teste em um passo de 30 s
 * e devolve o código da nova janela. `limparAmbienteTeste` restaura o relógio.
 */
export function codigosTotp(segredo: string): () => string {
  const inicio = relogioTeste.agora().getTime();
  let passos = 0;
  return () => {
    passos += 1;
    relogioTeste.definir(new Date(inicio + passos * 30_000));
    return codigoTotp(segredo, relogioTeste.agora().getTime());
  };
}
