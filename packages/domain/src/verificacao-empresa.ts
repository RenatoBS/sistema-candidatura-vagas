export type StatusEmpresa = 'PENDENTE' | 'VERIFICADA' | 'REJEITADA' | 'SUSPENSA';
export type PoliticaRevisaoManual = 'sempre' | 'falha' | 'nunca';
export type ResultadoChecagem = 'OK' | 'FALHA' | 'INDISPONIVEL';

export interface ChecagensEmpresa {
  email: ResultadoChecagem | null;
  dominio: ResultadoChecagem | null;
  cnpj: ResultadoChecagem | null;
}

export interface DecisaoVerificacao {
  status: StatusEmpresa;
  exigeRevisaoManual: boolean;
  motivo: string | null;
}

export function politicaRevisaoValida(valor: string | undefined): valor is PoliticaRevisaoManual {
  return valor === 'sempre' || valor === 'falha' || valor === 'nunca';
}

/**
 * Decide o estado depois das checagens automáticas.
 * `falha` (padrão): fila manual se CNPJ inativo/divergente, fonte indisponível ou domínio não confirmado.
 */
export function decidirAposChecagens(
  checagens: ChecagensEmpresa,
  politica: PoliticaRevisaoManual,
): DecisaoVerificacao {
  const emailOk = checagens.email === 'OK';
  const dominioOk = checagens.dominio === 'OK';
  const cnpjOk = checagens.cnpj === 'OK';
  const dominioFalhou = checagens.dominio === 'FALHA';
  const cnpjFalhou = checagens.cnpj === 'FALHA' || checagens.cnpj === 'INDISPONIVEL';

  if (!emailOk) {
    return { status: 'PENDENTE', exigeRevisaoManual: false, motivo: 'email_pendente' };
  }

  if (!dominioOk && !dominioFalhou) {
    return { status: 'PENDENTE', exigeRevisaoManual: false, motivo: 'dominio_pendente' };
  }

  if (emailOk && dominioOk && checagens.cnpj === null) {
    return { status: 'PENDENTE', exigeRevisaoManual: false, motivo: 'cnpj_pendente' };
  }

  const todasOk = emailOk && dominioOk && cnpjOk;
  const houveFalha = dominioFalhou || cnpjFalhou;

  if (todasOk && politica === 'sempre') {
    return { status: 'PENDENTE', exigeRevisaoManual: true, motivo: 'politica_sempre' };
  }

  if (todasOk) {
    return { status: 'VERIFICADA', exigeRevisaoManual: false, motivo: null };
  }

  if (houveFalha && politica === 'falha') {
    return { status: 'PENDENTE', exigeRevisaoManual: true, motivo: 'checagem_falhou' };
  }

  if (houveFalha && politica === 'sempre') {
    return { status: 'PENDENTE', exigeRevisaoManual: true, motivo: 'checagem_falhou' };
  }

  return { status: 'PENDENTE', exigeRevisaoManual: false, motivo: 'checagem_falhou' };
}

export type AcaoEstadoEmpresa = 'aprovar' | 'rejeitar' | 'suspender' | 'reativar' | 'reenviar';

export function transicionarEmpresa(
  atual: StatusEmpresa,
  acao: AcaoEstadoEmpresa,
): StatusEmpresa | null {
  if (acao === 'aprovar' && atual === 'PENDENTE') return 'VERIFICADA';
  if (acao === 'rejeitar' && atual === 'PENDENTE') return 'REJEITADA';
  if (acao === 'suspender' && atual === 'VERIFICADA') return 'SUSPENSA';
  if (acao === 'reativar' && atual === 'SUSPENSA') return 'VERIFICADA';
  if (acao === 'reenviar' && atual === 'REJEITADA') return 'PENDENTE';
  return null;
}

/** Publicar vaga exige empresa VERIFICADA, salvo bypass explícito do admin da plataforma. */
export function podePublicarVaga(status: StatusEmpresa, bypassAdmin: boolean): boolean {
  if (bypassAdmin) return true;
  return status === 'VERIFICADA';
}
