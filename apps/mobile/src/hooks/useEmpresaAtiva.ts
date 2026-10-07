import { empresaAtivaDaSessao } from '@/auth/acesso';
import { useAuth } from '@/auth/AuthContext';

export function useEmpresaAtiva(): string {
  const { sessao } = useAuth();
  return empresaAtivaDaSessao(sessao);
}
