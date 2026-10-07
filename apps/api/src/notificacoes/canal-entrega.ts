import type { NotificacaoRegistro } from '../repositorio/tipos';

export type TipoCanalEntrega = 'push' | 'email';

/**
 * Entrega fora do app. A central in-app é a fonte de verdade: falha aqui é
 * registrada e engolida. F6-07 (push) e F6-08 (e-mail) plugam implementações reais.
 */
export interface CanalEntrega {
  readonly canal: TipoCanalEntrega;
  entregar(notificacao: NotificacaoRegistro): Promise<void>;
}

export class CanalEntregaNoop implements CanalEntrega {
  constructor(readonly canal: TipoCanalEntrega) {}

  async entregar(): Promise<void> {}
}

/** Registra as entregas (testes). */
export class CanalEntregaMemoria implements CanalEntrega {
  entregues: NotificacaoRegistro[] = [];

  constructor(readonly canal: TipoCanalEntrega) {}

  async entregar(notificacao: NotificacaoRegistro): Promise<void> {
    this.entregues.push({ ...notificacao, dados: { ...notificacao.dados } });
  }

  limpar(): void {
    this.entregues = [];
  }
}
