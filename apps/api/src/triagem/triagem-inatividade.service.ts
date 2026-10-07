import { Inject, Injectable } from '@nestjs/common';
import {
  avaliarInatividade,
  POLITICA_INATIVIDADE_PADRAO,
  registrarAceiteTentativa,
  registrarPrimeiraResposta,
  type PoliticaInatividade,
} from '@scv/domain';

import type { Relogio } from '../auth/auth.service';
import { CandidaturaStateMachine } from '../candidaturas/candidatura-state-machine';
import { ErroAplicacao } from '../erros';
import type { Repositorio } from '../repositorio/tipos';
import { RELOGIO, REPOSITORIO } from '../tokens';

export interface AvaliadorTriagem {
  avaliarParcial(entrevistaId: string): Promise<void>;
}

/** Costura para F7-10 (Claude Code): a avaliação parcial real será enfileirada depois. */
export class AvaliadorTriagemNoop implements AvaliadorTriagem {
  async avaliarParcial(_entrevistaId: string): Promise<void> {}
}

const STATUS_ABANDONAVEL = new Set(['EM_ANDAMENTO', 'AGUARDANDO_RESPOSTA', 'PROCESSANDO']);

@Injectable()
export class TriagemInatividadeService {
  constructor(
    @Inject(REPOSITORIO) private readonly repo: Repositorio,
    @Inject(CandidaturaStateMachine) private readonly candidaturas: CandidaturaStateMachine,
    @Inject(RELOGIO) private readonly relogio: Relogio,
    @Inject(AvaliadorTriagemNoop) private readonly avaliador: AvaliadorTriagem,
  ) {}

  async registrarPrimeiraResposta(entrevistaId: string, agora = this.relogio.agora()) {
    const entrevista = await this.repo.buscarEntrevista(entrevistaId, { sistema: true });
    if (!entrevista)
      throw new ErroAplicacao('ENTREVISTA_NAO_ENCONTRADA', 404, 'entrevista não encontrada');
    const proxima = registrarPrimeiraResposta(entrevista, agora);
    return this.repo.atualizarEntrevista(
      entrevistaId,
      {
        iniciadaEm: proxima.iniciadaEm,
        ultimaInteracaoEm: proxima.ultimaInteracaoEm,
        status: entrevista.status === 'AGUARDANDO_INICIO' ? 'EM_ANDAMENTO' : entrevista.status,
      },
      { sistema: true },
      entrevista.atualizadoEm,
    );
  }

  async registrarAceite(entrevistaId: string, agora = this.relogio.agora()) {
    const entrevista = await this.repo.buscarEntrevista(entrevistaId, { sistema: true });
    if (!entrevista)
      throw new ErroAplicacao('ENTREVISTA_NAO_ENCONTRADA', 404, 'entrevista não encontrada');
    if (entrevista.iniciadaEm) {
      throw new ErroAplicacao('TENTATIVA_CONSUMIDA', 409, 'tentativa já consumida');
    }
    return this.repo.atualizarEntrevista(
      entrevistaId,
      {
        aceiteTentativaEm: registrarAceiteTentativa(entrevista.aceiteTentativaEm, agora),
        status: 'ACEITE_REGISTRADO',
      },
      { sistema: true },
      entrevista.atualizadoEm,
    );
  }

  async abandonarPorInatividade(
    entrevistaId: string,
    politica: PoliticaInatividade = POLITICA_INATIVIDADE_PADRAO,
    agora = this.relogio.agora(),
  ): Promise<{ abandonada: boolean; motivo: string }> {
    const entrevista = await this.repo.buscarEntrevista(entrevistaId, { sistema: true });
    if (!entrevista)
      throw new ErroAplicacao('ENTREVISTA_NAO_ENCONTRADA', 404, 'entrevista não encontrada');
    if (entrevista.status === 'ABANDONADA') return { abandonada: false, motivo: 'já abandonada' };
    if (!entrevista.iniciadaEm || !STATUS_ABANDONAVEL.has(entrevista.status)) {
      return { abandonada: false, motivo: 'entrevista não está aguardando resposta' };
    }
    if (avaliarInatividade(entrevista, agora, politica) !== 'ABANDONAR') {
      return { abandonada: false, motivo: 'prazo não vencido' };
    }

    const atualizada = await this.repo.atualizarEntrevista(
      entrevista.id,
      { status: 'ABANDONADA' },
      { sistema: true },
      entrevista.atualizadoEm,
    );
    if (!atualizada) return { abandonada: false, motivo: 'entrevista alterada em paralelo' };

    await this.repo.marcarRespostasParciais(entrevista.id, { sistema: true });
    await this.candidaturas.aplicar(
      entrevista.candidaturaId,
      { tipo: 'abandonarTriagem' },
      { autorId: null, motivo: 'inatividade após início da triagem' },
      { empresaId: entrevista.empresaId },
    );
    await this.avaliador.avaliarParcial(entrevista.id);
    return { abandonada: true, motivo: 'prazo de inatividade vencido' };
  }
}
