import { useQuery } from '@tanstack/react-query';

import { chaveConsulta } from '@/auth/acesso';
import { useAuth } from '@/auth/AuthContext';

export function useConsulta<T>(partes: string[], queryFn: () => Promise<T>, empresaId?: string | null) {
  const { sessao } = useAuth();
  const empresa = empresaId === undefined ? (sessao?.empresaAtivaId ?? null) : empresaId;
  return useQuery({
    queryKey: chaveConsulta(sessao?.visao ?? null, empresa, partes),
    queryFn,
  });
}
