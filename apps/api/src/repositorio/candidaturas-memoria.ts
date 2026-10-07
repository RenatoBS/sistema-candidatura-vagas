import { ErroAplicacao } from '../erros';
import type {
  CandidaturaRegistro,
  HistoricoStatusRegistro,
  TransicaoCandidaturaRegistro,
} from './candidaturas-tipos';
import type { ContextoTenant } from './tipos';

function permitido(ctx: ContextoTenant, empresaId: string): boolean {
  if (ctx.sistema || ctx.isAdmin) return true;
  return ctx.empresaId === empresaId;
}

export class CandidaturasMemoria {
  candidaturas = new Map<string, CandidaturaRegistro>();
  historico: HistoricoStatusRegistro[] = [];

  limpar(): void {
    this.candidaturas.clear();
    this.historico = [];
  }

  async criarCandidatura(
    dados: CandidaturaRegistro,
    historico: HistoricoStatusRegistro,
    ctx: ContextoTenant,
  ): Promise<CandidaturaRegistro> {
    if (!permitido(ctx, dados.empresaId))
      throw new ErroAplicacao('SEM_PERMISSAO', 403, 'sem permissão');
    const duplicada = [...this.candidaturas.values()].some(
      (item) => item.vagaId === dados.vagaId && item.candidatoId === dados.candidatoId,
    );
    if (duplicada)
      throw new ErroAplicacao('CANDIDATURA_DUPLICADA', 409, 'candidatura já existe para esta vaga');
    this.candidaturas.set(dados.id, { ...dados });
    this.historico.push({ ...historico });
    return { ...dados };
  }

  async buscarCandidatura(id: string, ctx: ContextoTenant): Promise<CandidaturaRegistro | null> {
    const item = this.candidaturas.get(id);
    if (!item || !permitido(ctx, item.empresaId)) return null;
    return { ...item };
  }

  async listarCandidaturasVaga(
    vagaId: string,
    ctx: ContextoTenant,
  ): Promise<CandidaturaRegistro[]> {
    return [...this.candidaturas.values()]
      .filter((item) => item.vagaId === vagaId && permitido(ctx, item.empresaId))
      .sort((a, b) => a.criadoEm.getTime() - b.criadoEm.getTime())
      .map((item) => ({ ...item }));
  }

  async listarCandidaturasCandidato(
    candidatoId: string,
    ctx: ContextoTenant,
  ): Promise<CandidaturaRegistro[]> {
    return [...this.candidaturas.values()]
      .filter((item) => item.candidatoId === candidatoId && permitido(ctx, item.empresaId))
      .map((item) => ({ ...item }));
  }

  async transicionarCandidatura(
    transicao: TransicaoCandidaturaRegistro,
    ctx: ContextoTenant,
  ): Promise<CandidaturaRegistro | null> {
    const atual = this.candidaturas.get(transicao.candidaturaId);
    if (!atual || !permitido(ctx, atual.empresaId)) return null;
    if (
      atual.status !== transicao.esperado.status ||
      atual.atualizadoEm.getTime() !== transicao.esperado.atualizadoEm.getTime()
    ) {
      return null;
    }
    const proxima = { ...atual, ...transicao.proximo };
    this.candidaturas.set(atual.id, proxima);
    this.historico.push({ ...transicao.historico });
    return { ...proxima };
  }

  async listarHistoricoStatus(
    candidaturaId: string,
    ctx: ContextoTenant,
  ): Promise<HistoricoStatusRegistro[]> {
    const candidatura = this.candidaturas.get(candidaturaId);
    if (!candidatura || !permitido(ctx, candidatura.empresaId)) return [];
    return this.historico
      .filter((item) => item.candidaturaId === candidaturaId)
      .sort((a, b) => a.criadoEm.getTime() - b.criadoEm.getTime())
      .map((item) => ({ ...item }));
  }
}
