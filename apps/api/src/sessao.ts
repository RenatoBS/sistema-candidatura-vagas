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

/** Recurso de outra empresa responde 404 (não revela existência), exceto para admin com MFA. */
export function exigirMesmaEmpresa(sessao: SessaoRequest, empresaId: string, recurso = 'recurso'): void {
  if (bypassAdmin(sessao.ator)) return;
  const membro = sessao.membro;
  if (sessao.empresaId !== empresaId || !membro || membro.empresaId !== empresaId || membro.status !== 'ATIVO') {
    throw new ErroAplicacao('NAO_ENCONTRADO', 404, `${recurso} não encontrado(a)`);
  }
}

/** Rotas `admin/*`: só ADMIN_PLATAFORMA com MFA verificado e na visão ADMIN. */
export function exigirAdminPlataforma(sessao: SessaoRequest): void {
  if (!sessao.usuario.papeisGlobais.includes('ADMIN_PLATAFORMA')) {
    throw new ErroAplicacao('SEM_PERMISSAO', 403, 'sem permissão');
  }
  if (!bypassAdmin(sessao.ator)) throw new ErroAplicacao('MFA_OBRIGATORIO', 403, 'MFA obrigatório');
  if (sessao.visao !== 'ADMIN') throw new ErroAplicacao('VISAO', 403, 'troque para a visão admin');
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
