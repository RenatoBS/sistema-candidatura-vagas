import { randomUUID } from 'node:crypto';

import { ErroAplicacao } from '../erros';
import type { EntrevistaRegistro } from './entrevistas-tipos';
import type { ContextoTenant, Repositorio } from './tipos';

function permitido(ctx: ContextoTenant, empresaId: string): boolean {
  return Boolean(ctx.sistema || ctx.isAdmin || ctx.empresaId === empresaId);
}

export class EntrevistasMemoria {
  entrevistas = new Map<string, EntrevistaRegistro>();

  limpar(): void {
    this.entrevistas.clear();
  }

  async criar(dados: EntrevistaRegistro, ctx: ContextoTenant): Promise<EntrevistaRegistro> {
    if (!permitido(ctx, dados.empresaId))
      throw new ErroAplicacao('SEM_PERMISSAO', 403, 'sem permissão');
    if (
      [...this.entrevistas.values()].some(
        (item) => item.candidaturaId === dados.candidaturaId && item.etapaId === dados.etapaId,
      )
    ) {
      throw new ErroAplicacao('ENTREVISTA_JA_EXISTE', 409, 'entrevista já existe para esta etapa');
    }
    this.entrevistas.set(dados.id, { ...dados });
    return { ...dados };
  }

  async buscar(id: string, ctx: ContextoTenant): Promise<EntrevistaRegistro | null> {
    const entrevista = this.entrevistas.get(id);
    return entrevista && permitido(ctx, entrevista.empresaId) ? { ...entrevista } : null;
  }

  async buscarPorCandidaturaEtapa(
    candidaturaId: string,
    etapaId: string,
    ctx: ContextoTenant,
  ): Promise<EntrevistaRegistro | null> {
    const entrevista = [...this.entrevistas.values()].find(
      (item) => item.candidaturaId === candidaturaId && item.etapaId === etapaId,
    );
    return entrevista && permitido(ctx, entrevista.empresaId) ? { ...entrevista } : null;
  }

  async atualizar(
    id: string,
    patch: Partial<EntrevistaRegistro>,
    ctx: ContextoTenant,
    esperadoAtualizadoEm?: Date,
  ): Promise<EntrevistaRegistro | null> {
    const atual = this.entrevistas.get(id);
    if (!atual || !permitido(ctx, atual.empresaId)) return null;
    if (esperadoAtualizadoEm && atual.atualizadoEm.getTime() !== esperadoAtualizadoEm.getTime())
      return null;
    const atualizadoEm =
      patch.atualizadoEm ?? new Date(Math.max(Date.now(), atual.atualizadoEm.getTime() + 1));
    const proxima = { ...atual, ...patch, id, atualizadoEm };
    this.entrevistas.set(id, proxima);
    return { ...proxima };
  }

  async listar(ctx: ContextoTenant): Promise<EntrevistaRegistro[]> {
    return [...this.entrevistas.values()]
      .filter((item) => permitido(ctx, item.empresaId))
      .map((item) => ({ ...item }));
  }

  async marcarRespostasParciais(
    repo: Repositorio,
    entrevistaId: string,
    ctx: ContextoTenant,
  ): Promise<void> {
    const entrevista = await this.buscar(entrevistaId, ctx);
    if (!entrevista) return;
    const existentes = await repo.listarRespostasEntrevista(entrevistaId, ctx);
    for (const resposta of existentes) {
      await repo.guardarResposta({ ...resposta, parcial: true, revisaoHumanaNecessaria: true });
    }
    const respondidas = new Set(existentes.map((resposta) => resposta.etapaPerguntaId));
    for (const vinculo of await repo.listarVinculosEtapa(entrevista.etapaId, ctx)) {
      if (respondidas.has(vinculo.id)) continue;
      await repo.guardarResposta({
        id: randomUUID(),
        empresaId: entrevista.empresaId,
        entrevistaId,
        etapaPerguntaId: vinculo.id,
        tipo: 'TEXTO_WHATSAPP',
        textoOriginal: null,
        audioUrl: null,
        transcricao: null,
        statusTranscricao: 'PENDENTE',
        revisaoHumanaNecessaria: true,
        parcial: true,
        expirou: false,
        tempoUsado: null,
      });
    }
  }
}
