import { randomUUID } from 'node:crypto';

import type { Relogio } from '../auth/auth.service';
import type { AuditoriaRegistro, ContextoTenant, Repositorio } from '../repositorio/tipos';

export class AuditoriaService {
  constructor(
    private readonly repo: Repositorio,
    private readonly relogio: Relogio,
  ) {}

  async registrar(
    entrada: Omit<AuditoriaRegistro, 'id' | 'criadoEm'>,
    ctx: ContextoTenant,
  ): Promise<AuditoriaRegistro> {
    return this.repo.registrarAuditoria(
      { ...entrada, id: randomUUID(), criadoEm: this.relogio.agora() },
      ctx,
    );
  }

  listar(ctx: ContextoTenant, empresaId?: string): Promise<AuditoriaRegistro[]> {
    return this.repo.listarAuditoria(ctx, empresaId);
  }
}
