import type { ContextoTenant } from './tipos';

/**
 * Filtro explícito por empresa, espelhando a política de RLS. Mantém o isolamento mesmo quando
 * a conexão usa um papel que ignora RLS (superuser/BYPASSRLS).
 */
export function escopoTenant(ctx: ContextoTenant): { empresaId?: string } {
  if (ctx.isAdmin || ctx.sistema || !ctx.empresaId) return {};
  return { empresaId: ctx.empresaId };
}
