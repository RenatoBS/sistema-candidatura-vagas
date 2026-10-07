import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { saidaAvaliacaoIaSchema } from '@scv/contracts';
import {
  interpretarAvaliacaoIa,
  montarPromptAvaliacao,
  notaContaNaMedia,
  VERSAO_PROMPT_TRIAGEM,
} from '@scv/domain';
import type { LlmProvider } from '@scv/llm';

import type { Relogio } from '../auth/auth.service';
import { CotaService } from '../capacidade/cota.service';
import type { AvaliacaoRegistro, Repositorio, RespostaSensivel } from '../repositorio/tipos';
import { LLM, RELOGIO, REPOSITORIO } from '../tokens';

const SISTEMA = { sistema: true as const };

@Injectable()
export class AvaliacaoTriagemService {
  constructor(
    @Inject(REPOSITORIO) private readonly repo: Repositorio,
    @Inject(LLM) private readonly llm: LlmProvider,
    @Inject(RELOGIO) private readonly relogio: Relogio,
    @Inject(CotaService) private readonly cotas: CotaService,
  ) {}

  async avaliar(respostaId: string): Promise<AvaliacaoRegistro | null> {
    const resposta = await this.repo.buscarResposta(respostaId, SISTEMA);
    if (!resposta) return null;
    const existentes = await this.repo.listarAvaliacoes(respostaId, SISTEMA);
    const ia = existentes.find((item) => item.avaliador === 'IA');
    if (ia) return ia;
    if (resposta.parcial && !resposta.transcricao && !resposta.textoOriginal) return null;
    const conteudo = (resposta.transcricao ?? resposta.textoOriginal ?? '').trim();
    if (!conteudo) return null;
    if (resposta.statusTranscricao === 'FALHA' || this.confiancaBaixa(resposta)) {
      return this.salvar(resposta, {
        nota: 0,
        criterios: { contaNaMedia: false, foraDaMedia: true, motivo: 'transcricao' },
        justificativa: 'Transcrição indisponível ou com confiança baixa. Revisão humana, sem penalidade.',
        confianca: resposta.confiancaTranscricao ?? 0,
        modelo: 'nenhum',
      });
    }
    const pergunta = resposta.etapaPerguntaId
      ? await this.enunciado(resposta.etapaPerguntaId)
      : { enunciado: 'Pergunta da triagem', rubrica: {} };
    this.cotas.consumirIa(resposta.empresaId, this.relogio.agora());
    const prompt = montarPromptAvaliacao({
      enunciado: pergunta.enunciado,
      conteudo,
      rubrica: pergunta.rubrica,
    });
    const respostaLlm = await this.llm.complete({
      mensagens: [
        { role: 'system', content: prompt.sistema },
        { role: 'user', content: prompt.usuario },
      ],
      json: true,
    });
    const interpretada = interpretarAvaliacaoIa(respostaLlm.texto);
    const validada = interpretada ? saidaAvaliacaoIaSchema.safeParse(interpretada) : null;
    if (!interpretada || !validada?.success) {
      return this.salvar(resposta, {
        nota: 0,
        criterios: { contaNaMedia: false, foraDaMedia: true, motivo: 'schema' },
        justificativa: 'A avaliação automática não passou na validação do schema.',
        confianca: 0,
        modelo: respostaLlm.modelo,
      });
    }
    const criterios = {
      ...interpretada.criterios,
      contaNaMedia: notaContaNaMedia(interpretada.criterios),
    };
    return this.salvar(resposta, {
      ...interpretada,
      criterios,
      modelo: respostaLlm.modelo,
    });
  }

  async avaliarParcial(entrevistaId: string): Promise<void> {
    const respostas = await this.repo.listarRespostasEntrevista(entrevistaId, SISTEMA);
    for (const resposta of respostas) {
      if (resposta.parcial && !resposta.transcricao && !resposta.textoOriginal) continue;
      await this.avaliar(resposta.id);
    }
  }

  private confiancaBaixa(resposta: RespostaSensivel): boolean {
    return (
      resposta.tipo === 'AUDIO_WHATSAPP' &&
      resposta.statusTranscricao === 'CONCLUIDA' &&
      resposta.revisaoHumanaNecessaria === true &&
      (resposta.confiancaTranscricao ?? 1) < 0.6
    );
  }

  private async enunciado(etapaPerguntaId: string): Promise<{ enunciado: string; rubrica: Record<string, unknown> }> {
    const entrevistas = await this.repo.listarEntrevistas(SISTEMA);
    for (const entrevista of entrevistas) {
      const vinculos = await this.repo.listarVinculosEtapa(entrevista.etapaId, SISTEMA);
      const vinculo = vinculos.find((item) => item.id === etapaPerguntaId);
      if (!vinculo) continue;
      const pergunta = await this.repo.buscarPergunta(vinculo.perguntaId, SISTEMA);
      return {
        enunciado: pergunta?.enunciado ?? 'Pergunta da triagem',
        rubrica: pergunta?.rubrica ?? {},
      };
    }
    return { enunciado: 'Pergunta da triagem', rubrica: {} };
  }

  private async salvar(
    resposta: RespostaSensivel,
    entrada: {
      nota: number;
      criterios: Record<string, unknown>;
      justificativa: string;
      confianca: number;
      modelo: string;
    },
  ): Promise<AvaliacaoRegistro> {
    const avaliacao: AvaliacaoRegistro = {
      id: randomUUID(),
      respostaId: resposta.id,
      avaliador: 'IA',
      nota: entrada.nota,
      criterios: { ...entrada.criterios, confianca: entrada.confianca },
      justificativa: entrada.justificativa,
      modelo: entrada.modelo,
      versaoPrompt: VERSAO_PROMPT_TRIAGEM,
      criadoEm: this.relogio.agora(),
    };
    await this.repo.salvarAvaliacao(avaliacao, { empresaId: resposta.empresaId, sistema: true });
    return avaliacao;
  }
}
