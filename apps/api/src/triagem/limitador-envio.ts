import { decidirRateLimit } from '@scv/domain';

export interface LimitadorEnvio {
  consumir(instanciaId: string, agora: Date): Promise<{ permitido: boolean; esperaMs: number }>;
}

/** Janela deslizante em memória. Os testes não dependem de Redis. */
export class LimitadorEnvioMemoria implements LimitadorEnvio {
  private readonly envios = new Map<string, number[]>();

  async consumir(instanciaId: string, agora: Date): Promise<{ permitido: boolean; esperaMs: number }> {
    const anteriores = (this.envios.get(instanciaId) ?? []).filter(
      (envio) => agora.getTime() - envio < 3_600_000,
    );
    const decisao = decidirRateLimit(anteriores, agora);
    if (!decisao.permitido) {
      this.envios.set(instanciaId, anteriores);
      return decisao;
    }
    anteriores.push(agora.getTime());
    this.envios.set(instanciaId, anteriores);
    return decisao;
  }

  limpar(): void {
    this.envios.clear();
  }
}
