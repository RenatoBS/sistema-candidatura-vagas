import { randomUUID } from 'node:crypto';

import { atendeObrigatorias, similaridadeCosseno, vagaElegivelParaMatch } from '@scv/domain';

import type {
  CandidatoSimilar,
  EntradaSugestaoMatch,
  ResultadoSugestaoMatch,
  SugestaoMatchRegistro,
  VagaSimilar,
} from './match-tipos';
import type { ContextoTenant, HabilidadeDoCandidato, PerfilCandidato } from './tipos';
import type { VagaHabilidadeRegistro, VagaRegistro } from './vagas-tipos';

export interface FonteMatchMemoria {
  candidatos(): Iterable<PerfilCandidato>;
  habilidadesCandidato(candidatoId: string): Promise<HabilidadeDoCandidato[]>;
  vagas(): Iterable<VagaRegistro>;
  habilidadesVaga(vagaId: string): VagaHabilidadeRegistro[];
}

function permitido(ctx: ContextoTenant, empresaId: string): boolean {
  if (ctx.sistema || ctx.isAdmin) return true;
  return ctx.empresaId === empresaId;
}

/** Mesma semântica da busca pgvector, com cosseno em memória (testes). */
export class MatchMemoria {
  embeddingsVaga = new Map<string, number[]>();
  embeddingsCandidato = new Map<string, number[]>();
  sugestoes = new Map<string, SugestaoMatchRegistro>();

  constructor(private readonly fonte: FonteMatchMemoria) {}

  limpar(): void {
    this.embeddingsVaga.clear();
    this.embeddingsCandidato.clear();
    this.sugestoes.clear();
  }

  async salvarEmbeddingVaga(vagaId: string, vetor: number[], ctx: ContextoTenant): Promise<boolean> {
    const vaga = this.vaga(vagaId);
    if (!vaga || !permitido(ctx, vaga.empresaId)) return false;
    this.embeddingsVaga.set(vagaId, [...vetor]);
    return true;
  }

  async salvarEmbeddingCandidato(candidatoId: string, vetor: number[]): Promise<boolean> {
    if (!this.perfil(candidatoId)) return false;
    this.embeddingsCandidato.set(candidatoId, [...vetor]);
    return true;
  }

  async buscarCandidatosSimilares(vagaId: string, limite: number, ctx: ContextoTenant): Promise<CandidatoSimilar[]> {
    const vaga = this.vaga(vagaId);
    const vetorVaga = this.embeddingsVaga.get(vagaId);
    if (!vaga || !vetorVaga || !permitido(ctx, vaga.empresaId)) return [];
    const exigidas = this.fonte.habilidadesVaga(vagaId);
    const saida: CandidatoSimilar[] = [];
    for (const perfil of this.fonte.candidatos()) {
      const vetor = this.embeddingsCandidato.get(perfil.id);
      if (!perfil.visivelParaMatch || !vetor) continue;
      const habilidades = (await this.fonte.habilidadesCandidato(perfil.id)).map((item) => ({
        habilidadeId: item.habilidadeId,
        nome: item.nome,
        nivel: item.nivel,
      }));
      if (!atendeObrigatorias(exigidas, habilidades)) continue;
      saida.push({ candidatoId: perfil.id, similaridade: similaridadeCosseno(vetorVaga, vetor), habilidades });
    }
    return saida.sort((a, b) => b.similaridade - a.similaridade).slice(0, limite);
  }

  async buscarVagasSimilares(candidatoId: string, agora: Date, limite: number): Promise<VagaSimilar[]> {
    const vetor = this.embeddingsCandidato.get(candidatoId);
    if (!vetor) return [];
    const habilidades = await this.fonte.habilidadesCandidato(candidatoId);
    const saida: VagaSimilar[] = [];
    for (const vaga of this.fonte.vagas()) {
      const vetorVaga = this.embeddingsVaga.get(vaga.id);
      if (!vetorVaga || !vagaElegivelParaMatch(vaga, agora)) continue;
      if (!atendeObrigatorias(this.fonte.habilidadesVaga(vaga.id), habilidades)) continue;
      saida.push({
        vagaId: vaga.id,
        empresaId: vaga.empresaId,
        status: vaga.status,
        prazoInscricoes: vaga.prazoInscricoes,
        similaridade: similaridadeCosseno(vetor, vetorVaga),
      });
    }
    return saida.sort((a, b) => b.similaridade - a.similaridade).slice(0, limite);
  }

  async registrarSugestao(entrada: EntradaSugestaoMatch, ctx: ContextoTenant): Promise<ResultadoSugestaoMatch | null> {
    const vaga = this.vaga(entrada.vagaId);
    if (!vaga || !permitido(ctx, vaga.empresaId)) return null;
    const atual = [...this.sugestoes.values()].find(
      (item) => item.vagaId === entrada.vagaId && item.candidatoId === entrada.candidatoId,
    );
    const base: SugestaoMatchRegistro = atual ?? {
      id: randomUUID(),
      vagaId: entrada.vagaId,
      candidatoId: entrada.candidatoId,
      compatibilidade: 0,
      explicacao: {},
      status: 'PENDENTE',
      notificadoEm: null,
      criadoEm: entrada.agora,
      atualizadoEm: entrada.agora,
    };
    const tornouForte = entrada.forte && base.status === 'PENDENTE';
    const proxima: SugestaoMatchRegistro = {
      ...base,
      compatibilidade: entrada.compatibilidade,
      explicacao: { ...entrada.explicacao },
      status: tornouForte ? 'NOTIFICADA' : base.status,
      atualizadoEm: entrada.agora,
    };
    this.sugestoes.set(proxima.id, proxima);
    return { sugestao: { ...proxima }, tornouForte };
  }

  async listarSugestoesVaga(vagaId: string, ctx: ContextoTenant): Promise<SugestaoMatchRegistro[]> {
    const vaga = this.vaga(vagaId);
    if (!vaga || !permitido(ctx, vaga.empresaId)) return [];
    return [...this.sugestoes.values()]
      .filter((item) => item.vagaId === vagaId)
      .sort((a, b) => b.compatibilidade - a.compatibilidade)
      .map((item) => ({ ...item }));
  }

  async listarSugestoesCandidato(candidatoId: string, ctx: ContextoTenant): Promise<SugestaoMatchRegistro[]> {
    return [...this.sugestoes.values()]
      .filter((item) => {
        const vaga = this.vaga(item.vagaId);
        return item.candidatoId === candidatoId && vaga !== null && permitido(ctx, vaga.empresaId);
      })
      .sort((a, b) => b.compatibilidade - a.compatibilidade)
      .map((item) => ({ ...item }));
  }

  private vaga(id: string): VagaRegistro | null {
    for (const vaga of this.fonte.vagas()) if (vaga.id === id) return vaga;
    return null;
  }

  private perfil(id: string): PerfilCandidato | null {
    for (const perfil of this.fonte.candidatos()) if (perfil.id === id) return perfil;
    return null;
  }
}
