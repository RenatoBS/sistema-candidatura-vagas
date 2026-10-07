import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import type { Armazenamento } from '@scv/providers';

import { AuditoriaService } from '../auditoria/auditoria.service';
import type { Relogio } from '../auth/auth.service';
import { ErroAplicacao } from '../erros';
import type { Repositorio } from '../repositorio/tipos';
import { ctxDe, exigir, montarAtor, papelAuditoria, type SessaoRequest } from '../sessao';
import { ARMAZENAMENTO, RELOGIO, REPOSITORIO } from '../tokens';

const EXPIRA_AUDIO_SEGUNDOS = 60;

@Injectable()
export class TriagemConsultaService {
  constructor(
    @Inject(REPOSITORIO) private readonly repo: Repositorio,
    @Inject(ARMAZENAMENTO) private readonly armazenamento: Armazenamento,
    @Inject(AuditoriaService) private readonly auditoria: AuditoriaService,
    @Inject(RELOGIO) private readonly relogio: Relogio,
  ) {}

  async listar(sessao: SessaoRequest, empresaId: string, vagaId: string) {
    const alinhada = await this.alinhar(sessao, empresaId);
    exigir(alinhada, 'ver_audio_transcricao');
    const ctx = ctxDe(alinhada, empresaId);
    const vaga = await this.repo.buscarVaga(vagaId, ctx);
    if (!vaga || vaga.empresaId !== empresaId) throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'vaga não encontrada');
    const candidaturas = await this.repo.listarCandidaturasVaga(vagaId, ctx);
    const entrevistas = await this.repo.listarEntrevistas(ctx);
    const ids = new Set(candidaturas.map((item) => item.id));
    return {
      itens: entrevistas
        .filter((item) => ids.has(item.candidaturaId) && item.canal === 'WHATSAPP')
        .map((item) => this.resumo(item)),
    };
  }

  async detalhe(sessao: SessaoRequest, empresaId: string, entrevistaId: string) {
    const alinhada = await this.alinhar(sessao, empresaId);
    exigir(alinhada, 'ver_audio_transcricao');
    const ctx = ctxDe(alinhada, empresaId);
    const entrevista = await this.repo.buscarEntrevista(entrevistaId, ctx);
    if (!entrevista || entrevista.empresaId !== empresaId) {
      throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'entrevista não encontrada');
    }
    const respostas = await this.repo.listarRespostasEntrevista(entrevistaId, ctx);
    const itens = [];
    for (const resposta of respostas) {
      const avaliacoes = await this.repo.listarAvaliacoes(resposta.id, ctx);
      const humana = [...avaliacoes].reverse().find((item) => item.avaliador === 'HUMANO');
      const ia = avaliacoes.find((item) => item.avaliador === 'IA');
      const exibida = humana ?? ia ?? null;
      itens.push({
        id: resposta.id,
        tipo: resposta.tipo ?? null,
        transcricao: resposta.transcricao,
        textoOriginal: resposta.textoOriginal ?? null,
        duracaoSegundos: resposta.duracaoSegundos ?? null,
        statusTranscricao: resposta.statusTranscricao ?? null,
        revisaoHumanaNecessaria: resposta.revisaoHumanaNecessaria ?? false,
        parcial: resposta.parcial ?? false,
        nota: exibida?.nota ?? null,
        notaOrigem: exibida?.avaliador ?? null,
        contaNaMedia: exibida ? exibida.criterios.contaNaMedia !== false : false,
        justificativa: exibida?.justificativa ?? null,
      });
    }
    return { ...this.resumo(entrevista), respostas: itens };
  }

  async audio(sessao: SessaoRequest, empresaId: string, entrevistaId: string, respostaId: string, motivo?: string) {
    if (!motivo?.trim()) throw new ErroAplicacao('MOTIVO_OBRIGATORIO', 400, 'motivo obrigatório');
    const alinhada = await this.alinhar(sessao, empresaId);
    exigir(alinhada, 'ver_audio_transcricao');
    const ctx = ctxDe(alinhada, empresaId);
    const resposta = await this.repo.buscarResposta(respostaId, ctx);
    if (!resposta || resposta.empresaId !== empresaId || resposta.entrevistaId !== entrevistaId || !resposta.audioUrl) {
      throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'áudio não encontrado');
    }
    await this.auditoria.registrar(
      {
        usuarioId: alinhada.usuario.id,
        empresaId,
        papel: papelAuditoria(alinhada),
        acao: 'LER_AUDIO',
        recursoTipo: 'AUDIO',
        recursoId: respostaId,
        motivo: motivo.trim(),
      },
      ctx,
    );
    return {
      url: await this.armazenamento.criarUrlDownload(resposta.audioUrl, EXPIRA_AUDIO_SEGUNDOS),
      expiraEmSegundos: EXPIRA_AUDIO_SEGUNDOS,
    };
  }

  async revisar(
    sessao: SessaoRequest,
    empresaId: string,
    entrevistaId: string,
    respostaId: string,
    entrada: { nota: number; justificativa: string },
  ) {
    const alinhada = await this.alinhar(sessao, empresaId);
    exigir(alinhada, 'revisao_humana');
    const ctx = ctxDe(alinhada, empresaId);
    const resposta = await this.repo.buscarResposta(respostaId, ctx);
    if (!resposta || resposta.empresaId !== empresaId || resposta.entrevistaId !== entrevistaId) {
      throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'resposta não encontrada');
    }
    if (entrada.nota < 0 || entrada.nota > 10) throw new ErroAplicacao('NOTA_INVALIDA', 400, 'nota entre 0 e 10');
    await this.repo.salvarAvaliacao(
      {
        id: randomUUID(),
        respostaId,
        avaliador: 'HUMANO',
        nota: entrada.nota,
        criterios: { contaNaMedia: true, origem: 'revisao' },
        justificativa: entrada.justificativa,
        modelo: null,
        versaoPrompt: null,
        criadoEm: this.relogio.agora(),
      },
      ctx,
    );
    return this.detalhe(sessao, empresaId, entrevistaId);
  }

  private resumo(entrevista: {
    id: string;
    candidaturaId: string;
    status: string;
    retryAtual: number;
    perguntaAtual: number;
    iniciadaEm: Date | null;
    proximoRetryEm: Date | null;
  }) {
    return {
      id: entrevista.id,
      candidaturaId: entrevista.candidaturaId,
      status: entrevista.status,
      retryAtual: entrevista.retryAtual,
      perguntaAtual: entrevista.perguntaAtual,
      iniciadaEm: entrevista.iniciadaEm?.toISOString() ?? null,
      proximoRetryEm: entrevista.proximoRetryEm?.toISOString() ?? null,
    };
  }

  private async alinhar(sessao: SessaoRequest, empresaId: string): Promise<SessaoRequest> {
    const ctx = ctxDe({ ...sessao, empresaId }, empresaId);
    const empresa = await this.repo.buscarEmpresaPorId(empresaId, ctx);
    const membro = await this.repo.buscarMembro(sessao.usuario.id, empresaId, ctx);
    const base = { ...sessao, empresaId, empresa, membro };
    return { ...base, ator: montarAtor(base) };
  }
}
