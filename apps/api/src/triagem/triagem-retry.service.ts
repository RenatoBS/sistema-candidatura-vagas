import { Inject, Injectable } from '@nestjs/common';
import {
  inatividadeDaPolitica,
  lerContexto,
  mensagemFluxoTriagem,
  mensagemTriagem,
  planejarRetry,
  politicaTriagemEfetiva,
  prazoInatividade,
  triagemTerminal,
  type PoliticaTriagem,
} from '@scv/domain';

import type { Relogio } from '../auth/auth.service';
import { CandidaturaStateMachine } from '../candidaturas/candidatura-state-machine';
import { FILA_TRIAGEM_RETRY, type FilaTriagem } from '../fila/fila-triagem';
import type { EntrevistaRegistro } from '../repositorio/entrevistas-tipos';
import type { Repositorio } from '../repositorio/tipos';
import { FILA_TRIAGEM, RELOGIO, REPOSITORIO } from '../tokens';
import { EnviadorWhatsapp } from './enviador-whatsapp';

const SISTEMA = { sistema: true as const };
const FILA_INATIVIDADE = 'triagem-inatividade';

@Injectable()
export class TriagemRetryService {
  constructor(
    @Inject(REPOSITORIO) private readonly repo: Repositorio,
    @Inject(RELOGIO) private readonly relogio: Relogio,
    @Inject(FILA_TRIAGEM) private readonly fila: FilaTriagem,
    @Inject(EnviadorWhatsapp) private readonly enviador: EnviadorWhatsapp,
    @Inject(CandidaturaStateMachine) private readonly candidaturas: CandidaturaStateMachine,
  ) {}

  async agendarProximo(entrevista: EntrevistaRegistro, restanteMs?: number | null): Promise<void> {
    if (entrevista.iniciadaEm || triagemTerminal(entrevista.status)) return;
    const politica = await this.politicaDa(entrevista);
    const agora = this.relogio.agora();
    const plano = planejarRetry({
      conviteEm: this.conviteEm(entrevista),
      retryAtual: entrevista.retryAtual,
      agora,
      politica,
      restanteMs,
    });
    if (plano.esgotado) {
      await this.agendarEsgotamento(entrevista, politica, agora);
      return;
    }
    const delayMs = Math.max(0, plano.quando.getTime() - agora.getTime());
    await this.fila.agendar({
      fila: FILA_TRIAGEM_RETRY,
      nome: 'retry',
      jobId: `retry:${entrevista.id}:${plano.proximoNumero}`,
      delayMs,
      data: { entrevistaId: entrevista.id, numero: plano.proximoNumero },
    });
    await this.repo.atualizarEntrevista(
      entrevista.id,
      { proximoRetryEm: plano.quando },
      SISTEMA,
      entrevista.atualizadoEm,
    );
  }

  async executar(entrevistaId: string, numero: number): Promise<{ enviado: boolean; motivo: string }> {
    const entrevista = await this.repo.buscarEntrevista(entrevistaId, SISTEMA);
    if (!entrevista) return { enviado: false, motivo: 'ausente' };
    if (entrevista.iniciadaEm || triagemTerminal(entrevista.status)) return { enviado: false, motivo: 'encerrada' };
    if (entrevista.status === 'SUSPENSA_PAUSA' || entrevista.status === 'SUSPENSA_INSTANCIA') {
      return { enviado: false, motivo: 'suspensa' };
    }
    if (entrevista.retryAtual >= numero) return { enviado: false, motivo: 'já enviado' };
    const politica = await this.politicaDa(entrevista);
    if (numero > politica.tentativas) {
      await this.marcarSemResposta(entrevista);
      return { enviado: false, motivo: 'SEM_RESPOSTA' };
    }
    const envio = await this.enviarLembrete(entrevista);
    if (!envio.ok) return { enviado: false, motivo: envio.motivo };
    const agora = this.relogio.agora();
    const atualizada = await this.repo.atualizarEntrevista(
      entrevista.id,
      {
        retryAtual: numero,
        status: numero <= 1 ? 'RETRY_1' : numero === 2 ? 'RETRY_2' : 'RETRY_3',
        proximoRetryEm: null,
      },
      SISTEMA,
      entrevista.atualizadoEm,
    );
    if (!atualizada) return { enviado: true, motivo: 'concorrência' };
    if (numero >= politica.tentativas) await this.agendarEsgotamento(atualizada, politica, agora);
    else await this.agendarProximo(atualizada);
    return { enviado: true, motivo: 'retry' };
  }

  async esgotar(entrevistaId: string): Promise<{ semResposta: boolean }> {
    const entrevista = await this.repo.buscarEntrevista(entrevistaId, SISTEMA);
    if (!entrevista || entrevista.iniciadaEm || triagemTerminal(entrevista.status)) return { semResposta: false };
    if (entrevista.status === 'SUSPENSA_PAUSA' || entrevista.status === 'SUSPENSA_INSTANCIA') {
      return { semResposta: false };
    }
    await this.marcarSemResposta(entrevista);
    return { semResposta: true };
  }

  async suspenderEmpresa(empresaId: string, motivo: 'PAUSA' | 'INSTANCIA', vagaId?: string): Promise<number> {
    const agora = this.relogio.agora();
    let total = 0;
    for (const entrevista of await this.entrevistasDaEmpresa(empresaId, vagaId)) {
      if (triagemTerminal(entrevista.status) || entrevista.status === 'SUSPENSA_PAUSA' || entrevista.status === 'SUSPENSA_INSTANCIA') {
        continue;
      }
      const politica = await this.politicaDa(entrevista);
      const prazo = prazoInatividade(entrevista, inatividadeDaPolitica(politica));
      const contexto = lerContexto(entrevista.contexto);
      await this.repo.atualizarEntrevista(
        entrevista.id,
        {
          status: motivo === 'PAUSA' ? 'SUSPENSA_PAUSA' : 'SUSPENSA_INSTANCIA',
          contexto: {
            ...contexto,
            statusAntesSuspensao: entrevista.status,
            suspensaEm: agora.toISOString(),
            motivoSuspensao: motivo,
            retryRestanteMs: entrevista.proximoRetryEm
              ? Math.max(0, entrevista.proximoRetryEm.getTime() - agora.getTime())
              : null,
            inatividadeRestanteMs:
              entrevista.iniciadaEm && prazo ? Math.max(0, prazo.getTime() - agora.getTime()) : null,
          },
        },
        SISTEMA,
      );
      total += 1;
    }
    return total;
  }

  async retomarEmpresa(empresaId: string, motivo: 'PAUSA' | 'INSTANCIA', vagaId?: string): Promise<number> {
    let total = 0;
    const esperado = motivo === 'PAUSA' ? 'SUSPENSA_PAUSA' : 'SUSPENSA_INSTANCIA';
    for (const entrevista of await this.entrevistasDaEmpresa(empresaId, vagaId)) {
      if (entrevista.status !== esperado) continue;
      const contexto = lerContexto(entrevista.contexto);
      const status = (contexto.statusAntesSuspensao ?? 'AGUARDANDO_INICIO') as EntrevistaRegistro['status'];
      const atualizada = await this.repo.atualizarEntrevista(
        entrevista.id,
        {
          status,
          contexto: {
            ...contexto,
            statusAntesSuspensao: null,
            suspensaEm: null,
            motivoSuspensao: null,
          },
        },
        SISTEMA,
      );
      if (!atualizada) continue;
      if (!atualizada.iniciadaEm) await this.agendarProximo(atualizada, contexto.retryRestanteMs);
      else if (contexto.inatividadeRestanteMs != null) await this.agendarInatividade(atualizada, contexto.inatividadeRestanteMs);
      total += 1;
    }
    return total;
  }

  async cancelarEmpresa(empresaId: string, vagaId?: string): Promise<number> {
    let total = 0;
    for (const entrevista of await this.entrevistasDaEmpresa(empresaId, vagaId)) {
      if (triagemTerminal(entrevista.status)) continue;
      await this.repo.atualizarEntrevista(entrevista.id, { status: 'CANCELADA', proximoRetryEm: null }, SISTEMA);
      total += 1;
    }
    return total;
  }

  async consumirEfeito(tipo: string, vagaId: string, empresaId: string): Promise<void> {
    if (tipo === 'SUSPENDER_RETRIES') await this.suspenderEmpresa(empresaId, 'PAUSA', vagaId);
    if (tipo === 'REAGENDAR_RETRIES') await this.retomarEmpresa(empresaId, 'PAUSA', vagaId);
    if (tipo === 'CANCELAR_RETRIES') await this.cancelarEmpresa(empresaId, vagaId);
  }

  async agendarInatividade(entrevista: EntrevistaRegistro, delayMs: number, sufixo = ''): Promise<void> {
    const iso = (entrevista.ultimaInteracaoEm ?? this.relogio.agora()).toISOString();
    await this.fila.agendar({
      fila: FILA_INATIVIDADE,
      nome: 'avaliar',
      // BullMQ só aceita ':' no formato de três segmentos; o ISO tem vários.
      jobId: `inatividade:${entrevista.id}:${iso}${sufixo}`.replaceAll(':', '-'),
      delayMs: Math.max(0, delayMs),
      data: { entrevistaId: entrevista.id, ultimaInteracaoEm: iso },
    });
  }

  private async agendarEsgotamento(entrevista: EntrevistaRegistro, politica: PoliticaTriagem, agora: Date): Promise<void> {
    const fim = this.conviteEm(entrevista).getTime() + politica.prazoTotalHoras * 60 * 60 * 1000;
    await this.fila.agendar({
      fila: FILA_TRIAGEM_RETRY,
      nome: 'esgotar',
      jobId: `retry:${entrevista.id}:esgotar`,
      delayMs: Math.max(0, fim - agora.getTime()),
      data: { entrevistaId: entrevista.id, numero: politica.tentativas + 1 },
    });
  }

  private async marcarSemResposta(entrevista: EntrevistaRegistro): Promise<void> {
    await this.repo.atualizarEntrevista(entrevista.id, { status: 'SEM_RESPOSTA', proximoRetryEm: null }, SISTEMA);
    const candidatura = await this.repo.buscarCandidatura(entrevista.candidaturaId, SISTEMA);
    if (candidatura?.status === 'TRIAGEM_WHATSAPP') {
      await this.candidaturas.aplicar(
        entrevista.candidaturaId,
        { tipo: 'esgotarRetries' },
        { autorId: null, motivo: 'retries da triagem esgotados' },
        { empresaId: entrevista.empresaId },
      );
    }
    const dados = await this.dadosMensagem(entrevista);
    const perfil = await this.perfilDa(entrevista);
    if (dados && perfil?.whatsapp) {
      await this.enviador.enviar({
        empresaId: entrevista.empresaId,
        candidatoId: perfil.id,
        numero: perfil.whatsapp,
        texto: mensagemFluxoTriagem('sem_resposta', dados).texto,
      });
    }
  }

  private async enviarLembrete(entrevista: EntrevistaRegistro) {
    const dados = await this.dadosMensagem(entrevista);
    const perfil = await this.perfilDa(entrevista);
    if (!dados || !perfil) return { ok: false as const, motivo: 'NUMERO_AUSENTE' as const };
    return this.enviador.enviar({
      empresaId: entrevista.empresaId,
      candidatoId: perfil.id,
      numero: perfil.whatsapp,
      texto: mensagemTriagem('lembrete_triagem', dados).texto,
    });
  }

  private async entrevistasDaEmpresa(empresaId: string, vagaId?: string): Promise<EntrevistaRegistro[]> {
    const entrevistas = (await this.repo.listarEntrevistas(SISTEMA)).filter((item) => item.empresaId === empresaId);
    if (!vagaId) return entrevistas;
    const candidaturas = await this.repo.listarCandidaturasVaga(vagaId, SISTEMA);
    const ids = new Set(candidaturas.map((item) => item.id));
    return entrevistas.filter((item) => ids.has(item.candidaturaId));
  }

  private async politicaDa(entrevista: EntrevistaRegistro): Promise<PoliticaTriagem> {
    const candidatura = await this.repo.buscarCandidatura(entrevista.candidaturaId, SISTEMA);
    const processo = candidatura
      ? await this.repo.buscarProcessoPorVaga(candidatura.vagaId, SISTEMA)
      : null;
    return politicaTriagemEfetiva(processo?.politicaRetry);
  }

  private conviteEm(entrevista: EntrevistaRegistro): Date {
    const iso = lerContexto(entrevista.contexto).conviteEm;
    return iso ? new Date(iso) : entrevista.criadoEm;
  }

  private async perfilDa(entrevista: EntrevistaRegistro) {
    const candidatura = await this.repo.buscarCandidatura(entrevista.candidaturaId, SISTEMA);
    if (!candidatura) return null;
    const candidato = await this.repo.buscarCandidatoPorId(candidatura.candidatoId);
    if (!candidato) return null;
    return this.repo.obterPerfil(candidato.usuarioId);
  }

  private async dadosMensagem(entrevista: EntrevistaRegistro) {
    const candidatura = await this.repo.buscarCandidatura(entrevista.candidaturaId, SISTEMA);
    if (!candidatura) return null;
    const vaga = await this.repo.buscarVaga(candidatura.vagaId, SISTEMA);
    const empresa = await this.repo.buscarEmpresaPorId(entrevista.empresaId, SISTEMA);
    if (!vaga || !empresa) return null;
    return { nomeVaga: vaga.titulo, nomeEmpresa: empresa.nomeFantasia };
  }
}
