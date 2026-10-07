import { bypassAdmin, decidirPermissao, type Acao, type Ator, type DecisaoPermissao, type Visao } from '@scv/domain';

import { ErroAplicacao } from './erros';
import type { ContextoTenant, EmpresaRegistro, MembroRegistro, UsuarioRegistro } from './repositorio/tipos';

export interface SessaoRequest {
  usuario: UsuarioRegistro;
  mfaVerificado: boolean;
  visao: Visao;
  empresaId: string | null;
  ehCandidato: boolean;
  membro: MembroRegistro | null;
  empresa: EmpresaRegistro | null;
  ator: Ator;
}

export function montarAtor(sessao: Omit<SessaoRequest, 'ator'>): Ator {
  return {
    autenticado: true,
    papeisGlobais: sessao.usuario.papeisGlobais,
    mfaAtivo: sessao.usuario.mfaAtivo,
    mfaVerificado: sessao.mfaVerificado,
    visao: sessao.visao,
    ehCandidato: sessao.ehCandidato,
    membro: sessao.membro
      ? {
          empresaId: sessao.membro.empresaId,
          papeis: sessao.membro.papeis,
          status: sessao.membro.status,
          statusEmpresa: sessao.empresa?.statusVerificacao ?? 'PENDENTE',
        }
      : null,
  };
}

export function exigir(sessao: SessaoRequest, acao: Acao): DecisaoPermissao {
  const decisao = decidirPermissao(sessao.ator, acao, {
    empresaId: sessao.empresaId ?? undefined,
  });
  if (!decisao.permitido) {
    const status = decisao.motivo === 'NAO_AUTENTICADO' ? 401 : 403;
    throw new ErroAplicacao(decisao.motivo ?? 'SEM_PERMISSAO', status, 'sem permissão');
  }
  return decisao;
}

export function ctxDe(sessao: SessaoRequest, empresaId?: string): ContextoTenant {
  return {
    empresaId: empresaId ?? sessao.empresaId ?? undefined,
    isAdmin: bypassAdmin(sessao.ator),
  };
}

/** Admin com MFA acessando empresa da qual não é membro. */
export function deveAuditarBypass(sessao: SessaoRequest, auditar: boolean): boolean {
  return auditar && bypassAdmin(sessao.ator) && sessao.membro === null;
}

export function papelAuditoria(sessao: SessaoRequest): string {
  if (sessao.usuario.papeisGlobais.includes('ADMIN_PLATAFORMA') && sessao.visao === 'ADMIN') {
    return 'ADMIN_PLATAFORMA';
  }
  return sessao.membro?.papeis[0] ?? 'CANDIDATO';
}
