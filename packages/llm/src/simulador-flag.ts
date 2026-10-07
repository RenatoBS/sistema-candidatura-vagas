import { envOu } from '@scv/env';

/** Liga o entrevistador e o chat de desenvolvimento. Em produção a flag é erro, não um modo silencioso. */
export function simuladorEntrevistaLigado(env: { SIMULADOR_ENTREVISTA?: string; NODE_ENV?: string }): boolean {
  const flag = envOu(env, 'SIMULADOR_ENTREVISTA', '').toLowerCase();
  const ligado = flag === 'true' || flag === '1';
  if (ligado && env.NODE_ENV === 'production') {
    throw new Error('SIMULADOR_ENTREVISTA não pode ser ligado em produção');
  }
  return ligado;
}
