import {
  decidirPermissao,
  type Acao,
  type Ator,
  type PapelEmpresa,
  type Visao,
} from '@scv/domain';

export interface EmpresaSessao {
  empresaId: string;
  nomeFantasia: string;
  papeis: PapelEmpresa[];
  status: 'ATIVO' | 'CONVIDADO' | 'REMOVIDO';
  statusVerificacao: 'PENDENTE' | 'VERIFICADA' | 'REJEITADA' | 'SUSPENSA';
}

export interface SessaoApp {
  id: string;
  email: string;
  papeisGlobais: Array<'ADMIN_PLATAFORMA'>;
  mfaAtivo: boolean;
  mfaVerificado: boolean;
  visao: Visao;
  empresaAtivaId: string | null;
  ehCandidato: boolean;
  empresas: EmpresaSessao[];
}

export type GrupoRota = 'candidato' | 'empresa' | 'admin';

export function atorDaSessao(sessao: SessaoApp | null): Ator {
  if (!sessao) {
    return {
      autenticado: false,
      papeisGlobais: [],
      mfaAtivo: false,
      mfaVerificado: false,
      visao: null,
      ehCandidato: false,
      membro: null,
    };
  }
  const empresa = sessao.empresas.find((item) => item.empresaId === sessao.empresaAtivaId) ?? sessao.empresas[0];
  return {
    autenticado: true,
    papeisGlobais: sessao.papeisGlobais,
    mfaAtivo: sessao.mfaAtivo,
    mfaVerificado: sessao.mfaVerificado,
    visao: sessao.visao,
    ehCandidato: sessao.ehCandidato,
    membro: empresa
      ? {
          empresaId: empresa.empresaId,
          papeis: empresa.papeis,
          status: empresa.status,
          statusEmpresa: empresa.statusVerificacao,
        }
      : null,
  };
}

export function podeAcao(sessao: SessaoApp | null, acao: Acao, empresaId?: string): boolean {
  const ator = atorDaSessao(sessao);
  const empresa = empresaId ?? sessao?.empresaAtivaId ?? undefined;
  return decidirPermissao(ator, acao, { empresaId: empresa ?? undefined }).permitido;
}

export function podeAcessarGrupo(
  sessao: SessaoApp | null,
  grupo: GrupoRota,
): { ok: boolean; redirecionar: '/login' | '/mfa' | '/onboarding' } {
  if (!sessao) return { ok: false, redirecionar: '/login' };
  if (grupo === 'admin') {
    if (!sessao.papeisGlobais.includes('ADMIN_PLATAFORMA')) return { ok: false, redirecionar: '/onboarding' };
    if (!sessao.mfaAtivo || !sessao.mfaVerificado || sessao.visao !== 'ADMIN') {
      return { ok: false, redirecionar: '/mfa' };
    }
    return { ok: true, redirecionar: '/login' };
  }
  if (grupo === 'empresa') {
    if (sessao.visao !== 'EMPRESA' || sessao.empresas.length === 0) {
      return { ok: false, redirecionar: '/onboarding' };
    }
    return { ok: true, redirecionar: '/login' };
  }
  if (!sessao.ehCandidato || sessao.visao !== 'CANDIDATO') {
    return { ok: false, redirecionar: '/onboarding' };
  }
  return { ok: true, redirecionar: '/login' };
}

export function chaveConsulta(visao: Visao | null, empresaId: string | null, partes: string[]): unknown[] {
  return [visao ?? 'anon', empresaId ?? 'sem-empresa', ...partes];
}

/** Destino após login: cada usuário cai direto na sua área; só vai ao seletor se não houver visão válida. */
export function rotaInicial(sessao: SessaoApp | null): '/login' | '/onboarding' | '/candidato' | '/empresa' | '/admin' | '/mfa' {
  if (!sessao) return '/login';
  if (podeAcessarGrupo(sessao, 'admin').ok) return '/admin';
  if (podeAcessarGrupo(sessao, 'empresa').ok) return '/empresa';
  if (podeAcessarGrupo(sessao, 'candidato').ok) return '/candidato';
  if (sessao.visao === 'ADMIN' && sessao.papeisGlobais.includes('ADMIN_PLATAFORMA')) return '/mfa';
  return '/onboarding';
}
