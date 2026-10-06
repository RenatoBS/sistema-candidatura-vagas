export type PapelGlobal = 'ADMIN_PLATAFORMA';
export type PapelEmpresa = 'ADMIN_EMPRESA' | 'RECRUTADOR' | 'AVALIADOR';
export type StatusMembro = 'ATIVO' | 'CONVIDADO' | 'REMOVIDO';
export type Visao = 'CANDIDATO' | 'EMPRESA' | 'ADMIN';

export const ACOES = [
  'aprovar_verificacao_empresa',
  'auto_cadastrar_empresa',
  'gerenciar_membros',
  'criar_vaga',
  'publicar_vaga',
  'pausar_vaga',
  'ver_vagas_publicas',
  'editar_proprio_perfil',
  'candidatar',
  'ver_status_propria_candidatura',
  'ver_score',
  'ver_audio_transcricao',
  'revisao_humana',
  'configurar_tenant',
  'conectar_whatsapp',
  'ver_status_whatsapp',
  'consultar_auditoria',
] as const;

export type Acao = (typeof ACOES)[number];

export interface MembroAtor {
  empresaId: string;
  papeis: PapelEmpresa[];
  status: StatusMembro;
  statusEmpresa: 'PENDENTE' | 'VERIFICADA' | 'REJEITADA' | 'SUSPENSA';
}

export interface Ator {
  autenticado: boolean;
  papeisGlobais: PapelGlobal[];
  mfaAtivo: boolean;
  mfaVerificado: boolean;
  visao: Visao | null;
  ehCandidato: boolean;
  membro: MembroAtor | null;
}

export interface ContextoAcao {
  empresaId?: string;
}

export interface DecisaoPermissao {
  permitido: boolean;
  motivo: string | null;
  auditar: boolean;
}

const RECRUTADOR_OU_ACIMA: PapelEmpresa[] = ['ADMIN_EMPRESA', 'RECRUTADOR'];
const AVALIADOR_OU_ACIMA: PapelEmpresa[] = ['ADMIN_EMPRESA', 'RECRUTADOR', 'AVALIADOR'];

export function bypassAdmin(ator: Pick<Ator, 'papeisGlobais' | 'mfaAtivo' | 'mfaVerificado'>): boolean {
  return (
    ator.papeisGlobais.includes('ADMIN_PLATAFORMA') && ator.mfaAtivo && ator.mfaVerificado
  );
}

function negar(motivo: string): DecisaoPermissao {
  return { permitido: false, motivo, auditar: false };
}

function permitir(auditar = false): DecisaoPermissao {
  return { permitido: true, motivo: null, auditar };
}

function adminNaVisao(ator: Ator): boolean {
  return bypassAdmin(ator) && ator.visao === 'ADMIN';
}

function membroAtivo(ator: Ator, empresaId: string | undefined): MembroAtor | null {
  if (!empresaId || !ator.membro) return null;
  if (ator.membro.status !== 'ATIVO') return null;
  if (ator.membro.empresaId !== empresaId) return null;
  return ator.membro;
}

function temPapel(ator: Ator, empresaId: string | undefined, papeis: PapelEmpresa[]): boolean {
  const membro = membroAtivo(ator, empresaId);
  if (!membro) return false;
  return membro.papeis.some((papel) => papeis.includes(papel));
}

export function decidirPermissao(ator: Ator, acao: Acao, ctx: ContextoAcao = {}): DecisaoPermissao {
  if (acao === 'ver_vagas_publicas') return permitir();

  if (!ator.autenticado) return negar('NAO_AUTENTICADO');

  if (acao === 'auto_cadastrar_empresa') return permitir();

  if (
    acao === 'editar_proprio_perfil' ||
    acao === 'candidatar' ||
    acao === 'ver_status_propria_candidatura'
  ) {
    if (ator.visao !== 'CANDIDATO') return negar('VISAO');
    if (!ator.ehCandidato) return negar('SEM_PERFIL_CANDIDATO');
    return permitir();
  }

  if (acao === 'ver_score') {
    if (ator.visao === 'CANDIDATO') return negar('SCORE_INVISIVEL_CANDIDATO');
    if (adminNaVisao(ator)) return permitir();
    if (ator.visao === 'EMPRESA' && temPapel(ator, ctx.empresaId, AVALIADOR_OU_ACIMA)) {
      return permitir();
    }
    return negar('SEM_PERMISSAO');
  }

  if (acao === 'aprovar_verificacao_empresa') {
    if (!ator.papeisGlobais.includes('ADMIN_PLATAFORMA')) return negar('SEM_PERMISSAO');
    if (!ator.mfaAtivo || !ator.mfaVerificado) return negar('MFA_OBRIGATORIO');
    if (ator.visao !== 'ADMIN') return negar('VISAO');
    return permitir(true);
  }

  if (acao === 'gerenciar_membros') {
    if (adminNaVisao(ator)) return permitir(true);
    if (ator.visao === 'EMPRESA' && temPapel(ator, ctx.empresaId, ['ADMIN_EMPRESA'])) {
      return permitir();
    }
    return negar('SEM_PERMISSAO');
  }

  if (acao === 'criar_vaga' || acao === 'pausar_vaga') {
    if (adminNaVisao(ator)) return permitir(true);
    if (ator.visao === 'EMPRESA' && temPapel(ator, ctx.empresaId, RECRUTADOR_OU_ACIMA)) {
      return permitir();
    }
    return negar('SEM_PERMISSAO');
  }

  if (acao === 'publicar_vaga') {
    if (adminNaVisao(ator)) return permitir(true);
    if (ator.visao !== 'EMPRESA' || !temPapel(ator, ctx.empresaId, RECRUTADOR_OU_ACIMA)) {
      return negar('SEM_PERMISSAO');
    }
    if (ator.membro?.statusEmpresa !== 'VERIFICADA') return negar('EMPRESA_NAO_VERIFICADA');
    return permitir();
  }

  if (acao === 'ver_audio_transcricao') {
    if (ator.visao === 'CANDIDATO') return negar('SEM_PERMISSAO');
    if (adminNaVisao(ator)) return permitir(true);
    if (ator.visao === 'EMPRESA' && temPapel(ator, ctx.empresaId, AVALIADOR_OU_ACIMA)) {
      return permitir(true);
    }
    return negar('SEM_PERMISSAO');
  }

  if (acao === 'revisao_humana') {
    if (adminNaVisao(ator)) return permitir();
    if (ator.visao === 'EMPRESA' && temPapel(ator, ctx.empresaId, AVALIADOR_OU_ACIMA)) {
      return permitir();
    }
    return negar('SEM_PERMISSAO');
  }

  if (acao === 'configurar_tenant' || acao === 'conectar_whatsapp') {
    if (adminNaVisao(ator)) return permitir(true);
    if (ator.visao === 'EMPRESA' && temPapel(ator, ctx.empresaId, ['ADMIN_EMPRESA'])) {
      return permitir();
    }
    return negar('SEM_PERMISSAO');
  }

  if (acao === 'ver_status_whatsapp' || acao === 'consultar_auditoria') {
    if (adminNaVisao(ator)) return permitir();
    if (ator.visao === 'EMPRESA' && membroAtivo(ator, ctx.empresaId)) return permitir();
    return negar('SEM_PERMISSAO');
  }

  return negar('SEM_PERMISSAO');
}

/** Papéis que podem ser concedidos por convite. Empresa não entra por convite. */
export const PAPEIS_CONVIDAVEIS: PapelEmpresa[] = ['RECRUTADOR', 'AVALIADOR'];

export function papeisConviteValidos(papeis: string[]): papeis is PapelEmpresa[] {
  return (
    papeis.length > 0 &&
    papeis.every((papel) => papel === 'RECRUTADOR' || papel === 'AVALIADOR')
  );
}
