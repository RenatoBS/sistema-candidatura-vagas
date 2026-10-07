import {
  atendeObrigatorias,
  calcularCompatibilidade,
  matchForte,
  textoEmbeddingCandidato,
  textoEmbeddingVaga,
  vagaElegivelParaMatch,
} from '@scv/domain';
import type { EmbeddingProvider } from '@scv/providers';

import type { Relogio } from '../auth/auth.service';
import type { ConfiguracaoApp } from '../configuracao';
import { ErroAplicacao } from '../erros';
import type { FilaMatch } from '../fila/fila-match';
import type { ContextoTenant, PerfilCandidato, Repositorio } from '../repositorio/tipos';

/** Teto de resultados da busca vetorial por execução do job. */
const LIMITE_BUSCA = 200;

export class MatchService {
  constructor(
    private readonly repo: Repositorio,
    private readonly embeddings: EmbeddingProvider,
    private readonly fila: FilaMatch,
    private readonly config: ConfiguracaoApp,
    private readonly relogio: Relogio,
  ) {}

  /** Job `embeddings:vaga`. Ao terminar, enfileira o match se a vaga estiver elegível. */
  async gerarEmbeddingVaga(vagaId: string) {
    const vaga = await this.repo.buscarVaga(vagaId, { sistema: true });
    if (!vaga) throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'vaga não encontrada');
    const ctx: ContextoTenant = { empresaId: vaga.empresaId };
    const habilidades = await this.repo.listarHabilidadesVaga(vagaId, ctx);
    const [vetor] = await this.embeddings.gerar([textoEmbeddingVaga({ ...vaga, habilidades })]);
    await this.repo.salvarEmbeddingVaga(vagaId, vetor ?? [], ctx);
    const elegivel = vagaElegivelParaMatch(vaga, this.relogio.agora());
    if (elegivel) await this.fila.enfileirarMatchVaga(vagaId);
    return { vagaId, gerado: true, matchEnfileirado: elegivel };
  }

  /** Job `embeddings:candidato`. Sem opt-in não gera: o texto do perfil não sai para o provedor. */
  async gerarEmbeddingCandidato(candidatoId: string) {
    const perfil = await this.exigirPerfilPorId(candidatoId);
    if (!perfil.visivelParaMatch) return { candidatoId, gerado: false, motivo: 'INVISIVEL_PARA_MATCH' as const };
    const habilidades = await this.repo.listarHabilidades(candidatoId);
    const texto = textoEmbeddingCandidato({ perfil: perfil.perfil, habilidades });
    if (!texto) return { candidatoId, gerado: false, motivo: 'PERFIL_VAZIO' as const };
    const [vetor] = await this.embeddings.gerar([texto]);
    await this.repo.salvarEmbeddingCandidato(candidatoId, vetor ?? []);
    await this.fila.enfileirarMatchCandidato(candidatoId);
    return { candidatoId, gerado: true };
  }

  /** Job `match:vaga` — vaga → candidatos. Idempotente: reexecutar só atualiza as sugestões. */
  async matchVaga(vagaId: string) {
    const vaga = await this.repo.buscarVaga(vagaId, { sistema: true });
    if (!vaga) throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'vaga não encontrada');
    if (!vagaElegivelParaMatch(vaga, this.relogio.agora())) {
      return { vagaId, ignorada: true, status: vaga.status, avaliados: 0, sugestoes: 0, fortes: 0 };
    }
    const ctx: ContextoTenant = { empresaId: vaga.empresaId };
    const exigidas = await this.repo.listarHabilidadesVaga(vagaId, ctx);
    const inscritos = new Set((await this.repo.listarCandidaturasVaga(vagaId, ctx)).map((item) => item.candidatoId));
    const similares = await this.repo.buscarCandidatosSimilares(vagaId, LIMITE_BUSCA, ctx);
    let sugestoes = 0;
    let fortes = 0;
    for (const candidato of similares) {
      if (inscritos.has(candidato.candidatoId) || !atendeObrigatorias(exigidas, candidato.habilidades)) continue;
      const registrada = await this.registrar(vaga.empresaId, vagaId, candidato.candidatoId, candidato.similaridade, exigidas, candidato.habilidades, ctx);
      if (!registrada) continue;
      sugestoes += 1;
      if (registrada.tornouForte) fortes += 1;
    }
    return { vagaId, ignorada: false, status: vaga.status, avaliados: similares.length, sugestoes, fortes };
  }

  /** Job `match:candidato` — candidato → vagas recomendadas. */
  async matchCandidato(candidatoId: string) {
    const perfil = await this.exigirPerfilPorId(candidatoId);
    if (!perfil.visivelParaMatch) return { candidatoId, ignorado: true, avaliadas: 0, sugestoes: 0, fortes: 0 };
    const agora = this.relogio.agora();
    const habilidades = (await this.repo.listarHabilidades(candidatoId)).map((item) => ({
      habilidadeId: item.habilidadeId,
      nome: item.nome,
      nivel: item.nivel,
    }));
    const inscritas = new Set(
      (await this.repo.listarCandidaturasCandidato(candidatoId, { sistema: true })).map((item) => item.vagaId),
    );
    const vagas = await this.repo.buscarVagasSimilares(candidatoId, agora, LIMITE_BUSCA);
    let sugestoes = 0;
    let fortes = 0;
    for (const vaga of vagas) {
      if (inscritas.has(vaga.vagaId) || !vagaElegivelParaMatch(vaga, agora)) continue;
      const ctx: ContextoTenant = { empresaId: vaga.empresaId };
      const exigidas = await this.repo.listarHabilidadesVaga(vaga.vagaId, ctx);
      if (!atendeObrigatorias(exigidas, habilidades)) continue;
      const registrada = await this.registrar(vaga.empresaId, vaga.vagaId, candidatoId, vaga.similaridade, exigidas, habilidades, ctx);
      if (!registrada) continue;
      sugestoes += 1;
      if (registrada.tornouForte) fortes += 1;
    }
    return { candidatoId, ignorado: false, avaliadas: vagas.length, sugestoes, fortes };
  }

  private async registrar(
    empresaId: string,
    vagaId: string,
    candidatoId: string,
    similaridade: number,
    exigidas: Parameters<typeof calcularCompatibilidade>[0]['exigidas'],
    habilidades: Parameters<typeof calcularCompatibilidade>[0]['candidato'],
    ctx: ContextoTenant,
  ) {
    const agora = this.relogio.agora();
    const resultado = calcularCompatibilidade({ similaridade, exigidas, candidato: habilidades });
    const registrada = await this.repo.registrarSugestao(
      {
        vagaId,
        candidatoId,
        compatibilidade: resultado.compatibilidade,
        explicacao: { ...resultado.explicacao },
        forte: matchForte(resultado.compatibilidade, this.config.matchLimiarForte),
        agora,
      },
      ctx,
    );
    if (registrada?.tornouForte) {
      await this.fila.publicarMatchForte({
        sugestaoId: registrada.sugestao.id,
        vagaId,
        empresaId,
        candidatoId,
        ocorridoEm: agora.toISOString(),
      });
    }
    return registrada;
  }

  private async perfilPorId(candidatoId: string): Promise<PerfilCandidato | null> {
    const candidato = await this.repo.buscarCandidatoPorId(candidatoId);
    return candidato ? this.repo.obterPerfil(candidato.usuarioId) : null;
  }

  private async exigirPerfilPorId(candidatoId: string): Promise<PerfilCandidato> {
    const perfil = await this.perfilPorId(candidatoId);
    if (!perfil) throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'candidato não encontrado');
    return perfil;
  }
}

