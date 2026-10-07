import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import {
  calcularScore,
  deveAguardarDebounce,
  mediaFase,
  PESOS_PADRAO,
  validarPesos,
  VERSAO_ALGORITMO_SCORE,
  type ChaveScore,
  type PesosScore,
} from '@scv/domain';

import { AuditoriaService } from '../auditoria/auditoria.service';
import type { Relogio } from '../auth/auth.service';
import { primeiroNome } from '../candidatos/identificacao';
import { ErroAplicacao } from '../erros';
import type { AvaliacaoRegistro, Repositorio, ScoreRegistro } from '../repositorio/tipos';
import { ctxDe, deveAuditarBypass, exigir, montarAtor, papelAuditoria, type SessaoRequest } from '../sessao';
import { RELOGIO, REPOSITORIO } from '../tokens';

const SISTEMA = { sistema: true as const };

@Injectable()
export class RankingService {
  private readonly ultimo = new Map<string, number>();

  constructor(
    @Inject(REPOSITORIO) private readonly repo: Repositorio,
    @Inject(RELOGIO) private readonly relogio: Relogio,
    @Inject(AuditoriaService) private readonly auditoria: AuditoriaService,
  ) {}

  async recalcular(vagaId: string, forcar = false) {
    const agora = this.relogio.agora().getTime();
    if (!forcar && deveAguardarDebounce(this.ultimo.get(vagaId) ?? null, agora)) {
      return { adiado: true as const, vagaId };
    }
    this.ultimo.set(vagaId, agora);
    const vaga = await this.repo.buscarVaga(vagaId, SISTEMA);
    if (!vaga) throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'vaga não encontrada');
    const pesos = this.pesos(vaga.pesosRanking);
    const candidaturas = await this.repo.listarCandidaturasVaga(vagaId, SISTEMA);
    const itens = [];
    for (const candidatura of candidaturas) {
      itens.push(await this.calcularUma(candidatura.id, pesos));
    }
    return { adiado: false as const, total: itens.length, itens };
  }

  async definirPesos(sessao: SessaoRequest, empresaId: string, vagaId: string, pesos: PesosScore) {
    const alinhada = await this.alinhar(sessao, empresaId);
    exigir(alinhada, 'criar_vaga');
    const ctx = ctxDe(alinhada, empresaId);
    if (!validarPesos(pesos).ok) throw new ErroAplicacao('PESOS_INVALIDOS', 400, 'pesos devem somar 100');
    const vaga = await this.repo.buscarVaga(vagaId, ctx);
    if (!vaga || vaga.empresaId !== empresaId) throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'vaga não encontrada');
    await this.repo.atualizarVaga(vagaId, { pesosRanking: pesos, atualizadoEm: this.relogio.agora() }, ctx);
    return this.recalcular(vagaId, true);
  }

  async listar(sessao: SessaoRequest, empresaId: string, vagaId: string, filtro?: { completudeMin?: number }) {
    const alinhada = await this.alinhar(sessao, empresaId);
    const decisao = exigir(alinhada, 'ver_score');
    const ctx = ctxDe(alinhada, empresaId);
    if (deveAuditarBypass(alinhada, decisao.auditar)) {
      await this.auditoria.registrar(
        {
          usuarioId: alinhada.usuario.id,
          empresaId,
          papel: papelAuditoria(alinhada),
          acao: 'BYPASS_ADMIN',
          recursoTipo: 'RANKING',
          recursoId: vagaId,
          motivo: 'ver_score',
        },
        ctx,
      );
    }
    const vaga = await this.repo.buscarVaga(vagaId, ctx);
    if (!vaga || vaga.empresaId !== empresaId) throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'vaga não encontrada');
    const candidaturas = await this.repo.listarCandidaturasVaga(vagaId, ctx);
    const ids = new Map(candidaturas.map((item) => [item.id, item]));
    const scores = (await this.repo.listarScores(ctx)).filter((item) => ids.has(item.candidaturaId));
    const minimo = filtro?.completudeMin ?? 0;
    const visiveis = scores
      .filter((item) => (item.completude ?? 0) >= minimo)
      .sort((a, b) => (b.scoreFinal ?? 0) - (a.scoreFinal ?? 0));
    const nomes = new Map<string, string>();
    for (const item of visiveis) {
      const candidatoId = ids.get(item.candidaturaId)?.candidatoId;
      if (candidatoId && !nomes.has(candidatoId)) {
        nomes.set(candidatoId, primeiroNome((await this.repo.buscarCandidatoPorId(candidatoId))?.nome));
      }
    }
    return {
      itens: visiveis
        .map((item) => ({
          candidaturaId: item.candidaturaId,
          candidatoNome: nomes.get(ids.get(item.candidaturaId)?.candidatoId ?? '') ?? 'Candidato',
          status: ids.get(item.candidaturaId)?.status ?? null,
          scoreFinal: item.scoreFinal,
          completude: item.completude,
          versaoAlgoritmo: item.versaoAlgoritmo,
          explicacao: item.explicacao,
        })),
    };
  }

  async vies(sessao: SessaoRequest, empresaId: string, vagaId: string) {
    const lista = await this.listar(sessao, empresaId, vagaId);
    const finais = lista.itens.map((item) => item.scoreFinal ?? 0);
    const faixas = [
      { faixa: '0-25', quantidade: finais.filter((nota) => nota < 25).length },
      { faixa: '25-50', quantidade: finais.filter((nota) => nota >= 25 && nota < 50).length },
      { faixa: '50-75', quantidade: finais.filter((nota) => nota >= 50 && nota < 75).length },
      { faixa: '75-100', quantidade: finais.filter((nota) => nota >= 75).length },
    ];
    const ctx = ctxDe(await this.alinhar(sessao, empresaId), empresaId);
    let pares = 0;
    let proximos = 0;
    let comExpiracao = 0;
    const notasCom: number[] = [];
    const notasSem: number[] = [];
    const entrevistaPorCandidatura = new Map<string, string>();
    for (const entrevista of await this.repo.listarEntrevistas(ctx)) {
      if (!entrevistaPorCandidatura.has(entrevista.candidaturaId)) entrevistaPorCandidatura.set(entrevista.candidaturaId, entrevista.id);
    }
    for (const item of lista.itens) {
      const entrevistaId = entrevistaPorCandidatura.get(item.candidaturaId);
      if (!entrevistaId) continue; // sem entrevista não há respostas (e '' não é UUID válido no Postgres)
      const respostas = await this.repo.listarRespostasEntrevista(entrevistaId, ctx);
      for (const resposta of respostas) {
        const avaliacoes = await this.repo.listarAvaliacoes(resposta.id, ctx);
        const ia = avaliacoes.find((avaliacao) => avaliacao.avaliador === 'IA');
        const humana = avaliacoes.find((avaliacao) => avaliacao.avaliador === 'HUMANO');
        if (ia && humana) {
          pares += 1;
          if (Math.abs(ia.nota - humana.nota) <= 2) proximos += 1;
        }
        if (resposta.expirou) {
          comExpiracao += 1;
          if (ia) notasCom.push(ia.nota);
        } else if (ia) notasSem.push(ia.nota);
      }
    }
    return {
      distribuicao: faixas,
      concordancia: { pares, proximos },
      expiracoes: {
        comExpiracao,
        mediaCom: media(notasCom),
        mediaSem: media(notasSem),
      },
    };
  }

  async revisar(
    sessao: SessaoRequest,
    empresaId: string,
    respostaId: string,
    entrada: { nota: number; justificativa: string },
  ) {
    const alinhada = await this.alinhar(sessao, empresaId);
    exigir(alinhada, 'revisao_humana');
    const ctx = ctxDe(alinhada, empresaId);
    const resposta = await this.repo.buscarResposta(respostaId, ctx);
    if (!resposta || resposta.empresaId !== empresaId || !resposta.entrevistaId) {
      throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'resposta não encontrada');
    }
    if (entrada.nota < 0 || entrada.nota > 10) throw new ErroAplicacao('NOTA_INVALIDA', 400, 'nota entre 0 e 10');
    await this.repo.salvarAvaliacao(
      {
        id: randomUUID(),
        respostaId,
        avaliador: 'HUMANO',
        nota: entrada.nota,
        criterios: { contaNaMedia: true, origem: 'revisao-ranking' },
        justificativa: entrada.justificativa,
        modelo: null,
        versaoPrompt: null,
        criadoEm: this.relogio.agora(),
      },
      ctx,
    );
    const entrevista = await this.repo.buscarEntrevista(resposta.entrevistaId, ctx);
    const candidatura = entrevista ? await this.repo.buscarCandidatura(entrevista.candidaturaId, ctx) : null;
    if (!candidatura) throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'candidatura não encontrada');
    await this.recalcular(candidatura.vagaId, true);
    const score = await this.repo.buscarScore(candidatura.id, ctx);
    return { scoreFinal: score?.scoreFinal ?? null, completude: score?.completude ?? null };
  }

  private async calcularUma(candidaturaId: string, pesos: PesosScore): Promise<ScoreRegistro> {
    const candidatura = await this.repo.buscarCandidatura(candidaturaId, SISTEMA);
    if (!candidatura) throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'candidatura não encontrada');
    const candidato = await this.repo.buscarCandidatoPorId(candidatura.candidatoId);
    const perfil = candidato ? await this.repo.obterPerfil(candidato.usuarioId) : null;
    const habilidades = await this.repo.listarHabilidades(candidatura.candidatoId);
    const curriculos = await this.repo.listarCurriculos(candidatura.candidatoId);
    const daVaga = await this.repo.listarHabilidadesVaga(candidatura.vagaId, SISTEMA);
    const entrevistas = (await this.repo.listarEntrevistas(SISTEMA)).filter(
      (item) => item.candidaturaId === candidaturaId,
    );
    const triagem = entrevistas.find((item) => item.canal === 'WHATSAPP');
    const voz = entrevistas.find((item) => item.canal === 'VOZ_TEMPO_REAL');
    const preenchidos = [perfil?.nome, perfil?.whatsapp, perfil?.perfil?.resumo].filter(Boolean).length;
    const obrigatorias = daVaga.filter((item) => item.obrigatoria);
    const habilidadesValor =
      obrigatorias.length === 0
        ? habilidades.length > 0
          ? 100
          : 0
        : (obrigatorias.filter((item) =>
            habilidades.some((linha) => linha.habilidadeId === item.habilidadeId && linha.nivel >= item.nivelMinimo),
          ).length /
            obrigatorias.length) *
          100;
    const curriculoPronto = curriculos.some((item) => item.statusProcessamento === 'CONCLUIDO');
    const triagemNotas = await this.notas(triagem?.id);
    const vozNotas = await this.notas(voz?.id);
    const faltantesTriagem = await this.faltantes(triagem?.id, triagem?.etapaId, triagemNotas.length);
    const faltantesVoz = await this.faltantes(voz?.id, voz?.etapaId, vozNotas.length);
    const modoTriagem =
      candidatura.status === 'SEM_RESPOSTA' ? 'zerado' : triagem ? 'parcial' : 'ausente';
    const modoVoz = voz ? 'parcial' : 'ausente';
    const componentes: Record<ChaveScore, { valor: number | null; sinalizado?: boolean }> = {
      perfil: { valor: (preenchidos / 3) * 100 },
      habilidades: { valor: habilidadesValor },
      curriculo: { valor: curriculoPronto ? 100 : null },
      linkedin: { valor: perfil?.linkedinUrl ? 100 : 0 },
      triagem: mediaFase(triagemNotas, modoTriagem === 'parcial' ? faltantesTriagem : 0, modoTriagem),
      voz: mediaFase(vozNotas, modoVoz === 'parcial' ? faltantesVoz : 0, modoVoz),
    };
    const calculado = calcularScore({ componentes, pesos });
    const agora = this.relogio.agora();
    return this.repo.salvarScore(
      {
        id: randomUUID(),
        candidaturaId,
        scorePerfil: componentes.perfil.valor,
        scoreHabilidades: componentes.habilidades.valor,
        scoreCurriculo: componentes.curriculo.valor,
        scoreLinkedin: componentes.linkedin.valor,
        scoreTriagem: componentes.triagem.valor,
        scoreEntrevista: componentes.voz.valor,
        scoreFinal: calculado.scoreFinal,
        completude: calculado.completude,
        explicacao: {
          texto: calculado.explicacao.texto,
          componentes: calculado.explicacao.componentes,
          versaoAlgoritmo: VERSAO_ALGORITMO_SCORE,
        },
        versaoAlgoritmo: VERSAO_ALGORITMO_SCORE,
        criadoEm: agora,
        atualizadoEm: agora,
      },
      SISTEMA,
    );
  }

  private async notas(entrevistaId?: string): Promise<{ nota: number; conta: boolean }[]> {
    if (!entrevistaId) return [];
    const respostas = await this.repo.listarRespostasEntrevista(entrevistaId, SISTEMA);
    const notas = [];
    for (const resposta of respostas) {
      const avaliacoes = await this.repo.listarAvaliacoes(resposta.id, SISTEMA);
      const escolhida = this.notaEfetiva(avaliacoes);
      if (!escolhida) continue;
      notas.push({
        nota: escolhida.nota,
        conta: escolhida.criterios.contaNaMedia !== false,
      });
    }
    return notas;
  }

  private notaEfetiva(avaliacoes: AvaliacaoRegistro[]): AvaliacaoRegistro | null {
    return [...avaliacoes].reverse().find((item) => item.avaliador === 'HUMANO') ?? avaliacoes.find((item) => item.avaliador === 'IA') ?? null;
  }

  private async faltantes(entrevistaId: string | undefined, etapaId: string | undefined, respondidas: number) {
    if (!entrevistaId || !etapaId) return 0;
    const vinculos = await this.repo.listarVinculosEtapa(etapaId, SISTEMA);
    return Math.max(0, vinculos.length - respondidas);
  }

  private pesos(bruto: Record<string, number> | null | undefined): PesosScore {
    const candidato = bruto as PesosScore | null | undefined;
    if (candidato && validarPesos(candidato).ok) return candidato;
    return { ...PESOS_PADRAO };
  }

  private async alinhar(sessao: SessaoRequest, empresaId: string): Promise<SessaoRequest> {
    const ctx = ctxDe({ ...sessao, empresaId }, empresaId);
    const empresa = await this.repo.buscarEmpresaPorId(empresaId, ctx);
    const membro = await this.repo.buscarMembro(sessao.usuario.id, empresaId, ctx);
    const base = { ...sessao, empresaId, empresa, membro };
    return { ...base, ator: montarAtor(base) };
  }
}

function media(valores: number[]): number | null {
  if (valores.length === 0) return null;
  return valores.reduce((total, valor) => total + valor, 0) / valores.length;
}
