import type { Acao } from '@scv/domain';

import { podeAcao } from '@/auth/acesso';
import { useAuth } from '@/auth/AuthContext';

/** A interface só reflete a permissão. O backend continua sendo a barreira. */
export function usePermissao(acao: Acao, empresaId?: string): boolean {
  const { sessao } = useAuth();
  return podeAcao(sessao, acao, empresaId);
}
