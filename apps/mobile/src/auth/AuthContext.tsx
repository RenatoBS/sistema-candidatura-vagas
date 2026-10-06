import { createContext, useCallback, useContext, useMemo, useState, type PropsWithChildren } from 'react';

import { api } from '@/api/cliente';
import type { SessaoApp } from '@/auth/acesso';
import { armazenamento } from '@/auth/armazenamento';

interface Tokens {
  accessToken: string;
  refreshToken: string;
}

interface AuthContextValue {
  sessao: SessaoApp | null;
  accessToken: string | null;
  pronto: boolean;
  entrar: (tokens: Tokens, perfil?: SessaoApp) => Promise<void>;
  sair: () => Promise<void>;
  atualizarPerfil: (perfil: SessaoApp) => void;
  recarregar: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const CHAVE = 'scv.sessao';

export function AuthProvider({ children }: PropsWithChildren) {
  const guardado = armazenamento.ler(CHAVE);
  const inicial = guardado ? (JSON.parse(guardado) as { accessToken: string; sessao: SessaoApp | null }) : null;
  const [accessToken, setAccessToken] = useState<string | null>(inicial?.accessToken ?? null);
  const [sessao, setSessao] = useState<SessaoApp | null>(inicial?.sessao ?? null);
  const [pronto] = useState(true);

  const persistir = useCallback((token: string | null, perfil: SessaoApp | null) => {
    setAccessToken(token);
    setSessao(perfil);
    if (!token) armazenamento.apagar(CHAVE);
    else armazenamento.gravar(CHAVE, JSON.stringify({ accessToken: token, sessao: perfil }));
  }, []);

  const recarregar = useCallback(async () => {
    if (!accessToken) return;
    const perfil = await api<SessaoApp>('/me', {}, accessToken);
    persistir(accessToken, { ...perfil, mfaVerificado: perfil.mfaVerificado, visao: perfil.visao });
  }, [accessToken, persistir]);

  const entrar = useCallback(
    async (tokens: Tokens, perfil?: SessaoApp) => {
      const me = perfil ?? (await api<SessaoApp>('/me', {}, tokens.accessToken));
      persistir(tokens.accessToken, me);
    },
    [persistir],
  );

  const sair = useCallback(async () => {
    persistir(null, null);
  }, [persistir]);

  const valor = useMemo(
    () => ({ sessao, accessToken, pronto, entrar, sair, atualizarPerfil: setSessao, recarregar }),
    [sessao, accessToken, pronto, entrar, sair, recarregar],
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const contexto = useContext(AuthContext);
  if (!contexto) throw new Error('useAuth fora do provider');
  return contexto;
}
