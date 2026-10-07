import { Inject, Injectable } from '@nestjs/common';
import {
  avaliarInatividade,
  inatividadeDaPolitica,
  lerContexto,
  mensagemTriagem,
  POLITICA_INATIVIDADE_PADRAO,
  politicaTriagemEfetiva,
  prazoInatividade,
  registrarAceiteTentativa,
  registrarPrimeiraResposta,
  type PoliticaInatividade,
} from '@scv/domain';

import type { Relogio } from '../auth/auth.service';
import { CandidaturaStateMachine } from '../candidaturas/candidatura-state-machine';
import { ErroAplicacao } from '../erros';
import type { EntrevistaRegistro } from '../repositorio/entrevistas-tipos';
import type { Repositorio } from '../repositorio/tipos';
import { AVALIADOR_TRIAGEM, RELOGIO, REPOSITORIO } from '../tokens';
import { EnviadorWhatsapp } from './enviador-whatsapp';
import { TriagemRetryService } from './triagem-retry.service';

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
    @Inject(AVALIADOR_TRIAGEM) private readonly avaliador: AvaliadorTriagem,
    @Inject(EnviadorWhatsapp) private readonly enviador: EnviadorWhatsapp,
    @Inject(TriagemRetryService) private readonly retries: TriagemRetryService,
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
    if (entrevista.status === 'SUSPENSA_PAUSA' || entrevista.status === 'SUSPENSA_INSTANCIA') {
      throw new ErroAplicacao('ENTREVISTA_SUSPENSA', 409, 'entrevista suspensa: o aceite aguarda a retomada');
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
    politica?: PoliticaInatividade,
    agora = this.relogio.agora(),
    ultimaInteracaoEsperada?: string,
  ): Promise<{ abandonada: boolean; motivo: string; lembrete?: boolean }> {
    const entrevista = await this.repo.buscarEntrevista(entrevistaId, { sistema: true });
    if (!entrevista)
      throw new ErroAplicacao('ENTREVISTA_NAO_ENCONTRADA', 404, 'entrevista não encontrada');
    if (
      ultimaInteracaoEsperada &&
      entrevista.ultimaInteracaoEm?.toISOString() !== ultimaInteracaoEsperada
    ) {
      return { abandonada: false, motivo: 'interação desatualizada' };
    }
    if (entrevista.status === 'ABANDONADA') return { abandonada: false, motivo: 'já abandonada' };
    if (!entrevista.iniciadaEm || !STATUS_ABANDONAVEL.has(entrevista.status)) {
      return { abandonada: false, motivo: 'entrevista não está aguardando resposta' };
    }
    const efetiva = politica ?? (await this.politicaDa(entrevista));
    const acao = avaliarInatividade(entrevista, agora, efetiva);
    if (acao === 'LEMBRETE') return this.enviarLembrete(entrevista, agora, efetiva);
    if (acao !== 'ABANDONAR') return { abandonada: false, motivo: 'prazo não vencido' };

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

  private async politicaDa(entrevista: EntrevistaRegistro): Promise<PoliticaInatividade> {
    const candidatura = await this.repo.buscarCandidatura(entrevista.candidaturaId, { sistema: true });
    const processo = candidatura
      ? await this.repo.buscarProcessoPorVaga(candidatura.vagaId, { sistema: true })
      : null;
    if (!processo?.politicaRetry) return POLITICA_INATIVIDADE_PADRAO;
    return inatividadeDaPolitica(politicaTriagemEfetiva(processo.politicaRetry));
  }

  private async enviarLembrete(
    entrevista: EntrevistaRegistro,
    agora: Date,
    politica: PoliticaInatividade,
  ): Promise<{ abandonada: boolean; motivo: string; lembrete?: boolean }> {
    const contexto = lerContexto(entrevista.contexto);
    if (contexto.lembreteInatividadeEm) return { abandonada: false, motivo: 'lembrete já enviado' };
    const candidatura = await this.repo.buscarCandidatura(entrevista.candidaturaId, { sistema: true });
    const vaga = candidatura ? await this.repo.buscarVaga(candidatura.vagaId, { sistema: true }) : null;
    const empresa = await this.repo.buscarEmpresaPorId(entrevista.empresaId, { sistema: true });
    const perfil = candidatura ? await this.perfil(candidatura.candidatoId) : null;
    let motivo = 'lembrete enviado';
    if (vaga && empresa && perfil?.whatsapp) {
      const envio = await this.enviador.enviar({
        empresaId: entrevista.empresaId,
        candidatoId: perfil.id,
        numero: perfil.whatsapp,
        texto: mensagemTriagem('lembrete_inatividade', {
          nomeVaga: vaga.titulo,
          nomeEmpresa: empresa.nomeFantasia,
        }).texto,
      });
      if (!envio.ok) motivo = envio.motivo;
    }
    await this.repo.atualizarEntrevista(
      entrevista.id,
      { contexto: { ...contexto, lembreteInatividadeEm: agora.toISOString() } },
      { sistema: true },
    );
    const prazo = prazoInatividade(entrevista, politica);
    if (prazo) {
      const vigente = await this.repo.buscarEntrevista(entrevista.id, { sistema: true });
      if (vigente) await this.retries.agendarInatividade(vigente, prazo.getTime() - agora.getTime(), ':prazo');
    }
    return { abandonada: false, motivo, lembrete: motivo === 'lembrete enviado' };
  }

  private async perfil(candidatoId: string) {
    const candidato = await this.repo.buscarCandidatoPorId(candidatoId);
    if (!candidato) return null;
    return this.repo.obterPerfil(candidato.usuarioId);
  }
}
