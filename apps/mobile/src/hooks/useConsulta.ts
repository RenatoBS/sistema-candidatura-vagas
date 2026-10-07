import { useQuery } from '@tanstack/react-query';

import { deveRepetir } from '@/api/repeticao';
import { chaveConsulta, empresaAtivaDaSessao } from '@/auth/acesso';
import { useAuth } from '@/auth/AuthContext';

export function useConsulta<T>(partes: string[], queryFn: () => Promise<T>, empresaId?: string | null) {
  const { sessao } = useAuth();
  const empresa = empresaId === undefined ? empresaAtivaDaSessao(sessao) || null : empresaId;
  return useQuery({
    queryKey: chaveConsulta(sessao?.visao ?? null, empresa, partes),
    queryFn,
    retry: deveRepetir,
  });
}
