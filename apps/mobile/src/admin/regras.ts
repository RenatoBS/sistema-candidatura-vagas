import type { CaminhoAcaoAdmin } from './acao-admin';

export type ProblemaAcaoAdmin = 'senha' | 'motivo';

/** A API exige motivo (3+ caracteres) para rejeitar e suspender; aprovar e reativar aceitam sem. */
export function motivoObrigatorio(caminho: CaminhoAcaoAdmin): boolean {
  return caminho === 'rejeitar' || caminho === 'suspender';
}

export function validarAcaoAdmin(caminho: CaminhoAcaoAdmin, senha: string, motivo: string): ProblemaAcaoAdmin | null {
  if (!senha) return 'senha';
  if (motivoObrigatorio(caminho) && motivo.trim().length < 3) return 'motivo';
  return null;
}

/** Ações de moderação disponíveis para cada status de verificação da empresa. */
export function acoesDaEmpresa(statusVerificacao: string): CaminhoAcaoAdmin[] {
  if (statusVerificacao === 'VERIFICADA') return ['suspender'];
  if (statusVerificacao === 'SUSPENSA') return ['reativar'];
  return [];
}
