export class Cronometro {
  private inicio = 0;

  marcar(): number {
    this.inicio = performance.now();
    return this.inicio;
  }

  elapsed(): number {
    return performance.now() - this.inicio;
  }
}

export async function medirEtapa<T>(
  _etapa: string,
  fn: () => Promise<T>,
  detalhe?: string,
): Promise<{ resultado: T; inicioMs: number; fimMs: number; duracaoMs: number; detalhe?: string }> {
  const inicioMs = performance.now();
  const resultado = await fn();
  const fimMs = performance.now();
  return {
    resultado,
    inicioMs,
    fimMs,
    duracaoMs: fimMs - inicioMs,
    detalhe,
  };
}
