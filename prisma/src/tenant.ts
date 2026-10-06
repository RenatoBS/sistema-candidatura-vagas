import { Prisma, PrismaClient } from '@prisma/client';

/** Contexto de tenant propagado para RLS via variáveis de sessão PostgreSQL. */
export interface TenantContext {
  empresaId?: string;
  isAdmin?: boolean;
}

/**
 * Define o contexto de tenant na transação atual (SET LOCAL).
 * Deve ser chamado no início de cada transação de negócio.
 */
export async function setTenantContext(
  tx: Prisma.TransactionClient,
  context: TenantContext,
): Promise<void> {
  const empresaId = context.empresaId ?? '';
  const isAdmin = context.isAdmin ? 'true' : 'false';

  await tx.$executeRaw`
    SELECT
      set_config('app.empresa_id', ${empresaId}, true),
      set_config('app.is_admin', ${isAdmin}, true)
  `;
}

export type TenantPrismaClient = PrismaClient & {
  /**
   * Executa callback dentro de transação com contexto RLS aplicado.
   */
  withTenant: <T>(context: TenantContext, fn: (tx: Prisma.TransactionClient) => Promise<T>) => Promise<T>;
};

/**
 * Cria cliente Prisma com helper `withTenant` para isolamento multi-tenant.
 * A RLS no PostgreSQL é a última barreira; este helper garante SET LOCAL consistente.
 */
export function createTenantPrisma(client?: PrismaClient): TenantPrismaClient {
  const prisma = client ?? new PrismaClient();
  const withTenant = async <T>(
    context: TenantContext,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> => {
    return prisma.$transaction(async (tx) => {
      await setTenantContext(tx, context);
      return fn(tx);
    });
  };

  return Object.assign(prisma, { withTenant });
}

/** Modelos com empresaId direto — documentação para guards da Fase 3. */
export const MODELOS_COM_EMPRESA_ID = [
  'Empresa',
  'VerificacaoEmpresa',
  'MembroEmpresa',
  'Vaga',
  'ProcessoSeletivo',
  'Pergunta',
  'Candidatura',
  'Entrevista',
  'Resposta',
  'InstanciaWhatsapp',
  'Notificacao',
  'PreferenciaNotificacao',
  'AuditoriaAcesso',
] as const;
