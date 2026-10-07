import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';

import { api, registrarRenovador } from '@/api/cliente';
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
  entrar: (tokens: Tokens, perfil?: SessaoApp) => Promise<SessaoApp>;
  sair: () => Promise<void>;
  atualizarPerfil: (perfil: SessaoApp) => void;
  recarregar: () => Promise<void>;
  /** Sessão gravada mais recente (síncrona; evita corrida entre setState e router.replace). */
  lerSessao: () => SessaoApp | null;
  lerToken: () => string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const CHAVE = 'scv.sessao';

export function AuthProvider({ children }: PropsWithChildren) {
  const guardado = armazenamento.ler(CHAVE);
  const inicial = guardado ? (JSON.parse(guardado) as { accessToken: string; refreshToken?: string; sessao: SessaoApp | null }) : null;
  const [accessToken, setAccessToken] = useState<string | null>(inicial?.accessToken ?? null);
  const [sessao, setSessao] = useState<SessaoApp | null>(inicial?.sessao ?? null);
  const [pronto] = useState(true);
  const refreshRef = useRef<string | null>(inicial?.refreshToken ?? null);
  const atualRef = useRef<SessaoApp | null>(inicial?.sessao ?? null);
  const lerSessao = useCallback(() => atualRef.current, []);
  const tokenRef = useRef<string | null>(inicial?.accessToken ?? null);
  const lerToken = useCallback(() => tokenRef.current, []);

  const persistir = useCallback((token: string | null, perfil: SessaoApp | null, refresh?: string | null) => {
    if (refresh !== undefined) refreshRef.current = refresh;
    if (!token) refreshRef.current = null;
    atualRef.current = token ? perfil : null;
    tokenRef.current = token;
    setAccessToken(token);
    setSessao(perfil);
    if (!token) armazenamento.apagar(CHAVE);
    else
      armazenamento.gravar(
        CHAVE,
        JSON.stringify({ accessToken: token, refreshToken: refreshRef.current, sessao: perfil }),
      );
  }, []);


  useEffect(() => {
    registrarRenovador(async () => {
      const refresh = refreshRef.current;
      if (!refresh) {
        persistir(null, null);
        return null;
      }
      try {
        const tokens = await api<Tokens>('/auth/refresh', {
          method: 'POST',
          body: JSON.stringify({ refreshToken: refresh }),
        });
        persistir(tokens.accessToken, atualRef.current, tokens.refreshToken);
        return tokens.accessToken;
      } catch {
        persistir(null, null);
        return null;
      }
    });
    return () => registrarRenovador(null);
  }, [persistir]);

  const recarregar = useCallback(async () => {
    if (!accessToken) return;
    const perfil = await api<SessaoApp>('/me', {}, accessToken);
    persistir(accessToken, { ...perfil, mfaVerificado: perfil.mfaVerificado, visao: perfil.visao });
  }, [accessToken, persistir]);

  const entrar = useCallback(
    async (tokens: Tokens, perfil?: SessaoApp) => {
      const me = perfil ?? (await api<SessaoApp>('/me', {}, tokens.accessToken));
      persistir(tokens.accessToken, me, tokens.refreshToken || undefined);
      return me;
    },
    [persistir],
  );

  const sair = useCallback(async () => {
    persistir(null, null);
  }, [persistir]);

  const atualizarPerfil = useCallback((perfil: SessaoApp) => {
    atualRef.current = perfil;
    setSessao(perfil);
  }, []);

  const valor = useMemo(
    () => ({ sessao, accessToken, pronto, entrar, sair, atualizarPerfil, recarregar, lerSessao, lerToken }),
    [sessao, accessToken, pronto, entrar, sair, recarregar, lerSessao, lerToken, atualizarPerfil],
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const contexto = useContext(AuthContext);
  if (!contexto) throw new Error('useAuth fora do provider');
  // Lê a sessão/token gravados de forma síncrona: logo após entrar() + router.replace(),
  // o estado do provider ainda pode não ter sido propagado para a nova tela.
  return { ...contexto, sessao: contexto.lerSessao() ?? contexto.sessao, accessToken: contexto.lerToken() ?? contexto.accessToken };
}
