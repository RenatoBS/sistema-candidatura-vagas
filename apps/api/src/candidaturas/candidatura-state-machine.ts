import { randomUUID } from 'node:crypto';

import {
  COMANDO_POR_EFEITO_VAGA,
  criarCandidatura,
  transicionarCandidatura,
  type ComandoCandidatura,
  type ComandoCriacaoCandidatura,
  type ComandoEfeitoVaga,
  type ErroTransicaoCandidatura,
  type ResultadoTransicaoCandidatura,
} from '@scv/domain';

import type { Relogio } from '../auth/auth.service';
import { ErroAplicacao } from '../erros';
import type { CandidaturaRegistro, ContextoTenant, OrigemCandidatura, Repositorio } from '../repositorio/tipos';

const MENSAGENS: Record<ErroTransicaoCandidatura, string> = {
  TRANSICAO_INVALIDA: 'transição de candidatura inválida',
  CANDIDATURA_ENCERRADA: 'candidatura encerrada',
  INSCRICOES_INDISPONIVEIS: 'inscrições não disponíveis',
  DECISAO_HUMANA_OBRIGATORIA: 'decisão exige uma pessoa da empresa',
  ESTADO_ANTERIOR_AUSENTE: 'estado anterior à espera ausente',
};

const STATUS_HTTP: Record<ErroTransicaoCandidatura, number> = {
  TRANSICAO_INVALIDA: 409,
  CANDIDATURA_ENCERRADA: 409,
  INSCRICOES_INDISPONIVEIS: 409,
  DECISAO_HUMANA_OBRIGATORIA: 403,
  ESTADO_ANTERIOR_AUSENTE: 409,
};

/** Retentativas quando outra transição grava entre a leitura e a escrita. */
const TENTATIVAS_CONFLITO = 3;

export interface AutoriaTransicao {
  /** `null` para jobs e eventos do sistema. */
  autorId: string | null;
  motivo?: string | null;
}

export interface NovaCandidatura {
  empresaId: string;
  vagaId: string;
  candidatoId: string;
  origem: OrigemCandidatura;
  etapaAtualId?: string | null;
}

export interface ResumoEfeitoVaga {
  aplicadas: number;
  ignoradas: number;
}

/**
 * Ponto único de transição da candidatura: valida no domínio, grava com controle otimista
 * e registra `HistoricoStatus` (de → para, autor, motivo) na mesma transação.
 */
export class CandidaturaStateMachine {
  constructor(
    private readonly repo: Repositorio,
    private readonly relogio: Relogio,
  ) {}

  async criar(
    dados: NovaCandidatura,
    comando: ComandoCriacaoCandidatura,
    autoria: AutoriaTransicao,
    ctx: ContextoTenant,
  ): Promise<CandidaturaRegistro> {
    const resultado = exigirOk(criarCandidatura(comando));
    const agora = this.relogio.agora();
    const id = randomUUID();
    return this.repo.criarCandidatura(
      {
        id,
        empresaId: dados.empresaId,
        vagaId: dados.vagaId,
        candidatoId: dados.candidatoId,
        origem: dados.origem,
        status: resultado.estado.status,
        statusAntesDaEspera: null,
        etapaAtualId: dados.etapaAtualId ?? null,
        criadoEm: agora,
        atualizadoEm: agora,
      },
      {
        id: randomUUID(),
        candidaturaId: id,
        de: 'NOVA',
        para: resultado.estado.status,
        autorId: autoria.autorId,
        motivo: autoria.motivo ?? null,
        criadoEm: agora,
      },
      ctx,
    );
  }

  async aplicar(
    candidaturaId: string,
    comando: ComandoCandidatura,
    autoria: AutoriaTransicao,
    ctx: ContextoTenant,
  ): Promise<CandidaturaRegistro> {
    for (let tentativa = 0; tentativa < TENTATIVAS_CONFLITO; tentativa += 1) {
      const atual = await this.repo.buscarCandidatura(candidaturaId, ctx);
      if (!atual) throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'candidatura não encontrada');
      const salva = await this.gravar(atual, exigirOk(transicionarCandidatura(atual, comando)), autoria, ctx);
      if (salva) return salva;
    }
    throw new ErroAplicacao('CONFLITO_CONCORRENCIA', 409, 'candidatura alterada em paralelo; tente novamente');
  }

  /**
   * Aplica um efeito de evento de vaga (F4-09) em todas as candidaturas da vaga.
   * Candidaturas em que o comando não se aplica (terminais, já em espera) são ignoradas,
   * o que torna o reprocessamento do evento idempotente.
   */
  async aplicarEfeitoVaga(
    vagaId: string,
    efeito: string,
    autoria: AutoriaTransicao,
    ctx: ContextoTenant,
  ): Promise<ResumoEfeitoVaga> {
    const tipo = COMANDO_POR_EFEITO_VAGA[efeito];
    const resumo: ResumoEfeitoVaga = { aplicadas: 0, ignoradas: 0 };
    if (!tipo) return resumo;
    const comando: ComandoEfeitoVaga = { tipo };
    for (const candidatura of await this.repo.listarCandidaturasVaga(vagaId, ctx)) {
      if (await this.aplicarSePossivel(candidatura, comando, autoria, ctx)) resumo.aplicadas += 1;
      else resumo.ignoradas += 1;
    }
    return resumo;
  }

  private async aplicarSePossivel(
    candidatura: CandidaturaRegistro,
    comando: ComandoCandidatura,
    autoria: AutoriaTransicao,
    ctx: ContextoTenant,
  ): Promise<boolean> {
    let atual: CandidaturaRegistro | null = candidatura;
    for (let tentativa = 0; atual && tentativa < TENTATIVAS_CONFLITO; tentativa += 1) {
      const resultado = transicionarCandidatura(atual, comando);
      if (!resultado.ok) return false;
      if (await this.gravar(atual, resultado, autoria, ctx)) return true;
      atual = await this.repo.buscarCandidatura(candidatura.id, ctx);
    }
    if (!atual) return false;
    throw new ErroAplicacao('CONFLITO_CONCORRENCIA', 409, 'candidatura alterada em paralelo; tente novamente');
  }

  private gravar(
    atual: CandidaturaRegistro,
    resultado: Extract<ResultadoTransicaoCandidatura, { ok: true }>,
    autoria: AutoriaTransicao,
    ctx: ContextoTenant,
  ): Promise<CandidaturaRegistro | null> {
    const agora = this.relogio.agora();
    // `atualizadoEm` precisa mudar a cada transição (controle otimista), mesmo com relógio parado.
    const atualizadoEm = agora.getTime() > atual.atualizadoEm.getTime() ? agora : new Date(atual.atualizadoEm.getTime() + 1);
    return this.repo.transicionarCandidatura(
      {
        candidaturaId: atual.id,
        esperado: { status: atual.status, atualizadoEm: atual.atualizadoEm },
        proximo: { ...resultado.estado, atualizadoEm },
        historico: {
          id: randomUUID(),
          candidaturaId: atual.id,
          de: atual.status,
          para: resultado.estado.status,
          autorId: autoria.autorId,
          motivo: autoria.motivo ?? null,
          criadoEm: agora,
        },
      },
      ctx,
    );
  }
}

function exigirOk(resultado: ResultadoTransicaoCandidatura): Extract<ResultadoTransicaoCandidatura, { ok: true }> {
  if (!resultado.ok) throw new ErroAplicacao(resultado.codigo, STATUS_HTTP[resultado.codigo], MENSAGENS[resultado.codigo]);
  return resultado;
}
