import { randomUUID } from 'node:crypto';

import { Logger } from '@nestjs/common';
import {
  agrupavel,
  algumCanal,
  canaisEfetivos,
  chaveDedup,
  decidirAgrupamento,
  limiarPreferenciaValido,
  PREFERENCIA_PADRAO,
  vagaNotificavel,
  type CanaisNotificacao,
  type PreferenciaCanais,
  type TipoNotificacaoEmpresa,
} from '@scv/domain';

import type { Relogio } from '../auth/auth.service';
import type { ConfiguracaoApp } from '../configuracao';
import { ErroAplicacao } from '../erros';
import type {
  CandidaturaRegistro,
  ContextoTenant,
  NotificacaoRegistro,
  Repositorio,
  VagaRegistro,
} from '../repositorio/tipos';
import { ctxDe, type SessaoRequest } from '../sessao';
import type { CanalEntrega } from './canal-entrega';

const TIPOS: TipoNotificacaoEmpresa[] = ['CANDIDATO_NOVO', 'MATCH_FORTE'];
const PAPEIS_DESTINATARIOS = new Set(['ADMIN_EMPRESA', 'RECRUTADOR']);
const LIMITE_PADRAO = 20;
const LIMITE_MAXIMO = 50;
/** Campos de um candidato só: somem quando a notificação vira resumo. */
const CAMPOS_INDIVIDUAIS = ['candidaturaId', 'candidatoId'];

export interface PreferenciaEntrada {
  tipo: TipoNotificacaoEmpresa;
  inApp?: boolean;
  push?: boolean;
  email?: boolean;
  limiarMatch?: number | null;
}

export class NotificacoesService {
  private readonly logger = new Logger('NotificacoesService');

  constructor(
    private readonly repo: Repositorio,
    private readonly canais: readonly CanalEntrega[],
    private readonly config: ConfiguracaoApp,
    private readonly relogio: Relogio,
  ) {}

  /**
   * CANDIDATO_NOVO (candidatura direta ou convite aceito). Nunca derruba a
   * candidatura: erro é registrado e a central fica sem esta notificação.
   */
  async candidatoNovo(candidatura: Pick<CandidaturaRegistro, 'id' | 'empresaId' | 'vagaId' | 'candidatoId' | 'origem'>) {
    try {
      const vaga = await this.repo.buscarVaga(candidatura.vagaId, { sistema: true });
      if (!vaga || !vagaNotificavel(vaga.status)) return { notificadas: 0 };
      const notificadas = await this.notificarEmpresa(vaga, 'CANDIDATO_NOVO', {
        dados: { candidaturaId: candidatura.id, candidatoId: candidatura.candidatoId, origem: candidatura.origem },
        chave: (usuarioId) => chaveDedup({ tipo: 'CANDIDATO_NOVO', usuarioId, vagaId: vaga.id, agora: this.relogio.agora() }),
      });
      return { notificadas };
    } catch (erro) {
      this.logger.error({ err: erro, candidaturaId: candidatura.id }, 'falha ao notificar candidato novo');
      return { notificadas: 0 };
    }
  }

  /** Consumidor do evento `match.forte` (fila `notificacoes`). Idempotente por `chaveDedup` e `notificadoEm`. */
  async matchForte(sugestaoId: string) {
    const sugestao = await this.repo.buscarSugestao(sugestaoId, { sistema: true });
    if (!sugestao) return { sugestaoId, notificadas: 0, motivo: 'SUGESTAO_INEXISTENTE' as const };
    if (sugestao.notificadoEm) return { sugestaoId, notificadas: 0, motivo: 'JA_NOTIFICADA' as const };
    const vaga = await this.repo.buscarVaga(sugestao.vagaId, { sistema: true });
    if (!vaga || !vagaNotificavel(vaga.status)) return { sugestaoId, notificadas: 0, motivo: 'VAGA_INDISPONIVEL' as const };
    const candidato = await this.repo.buscarCandidatoPorId(sugestao.candidatoId);
    const perfil = candidato ? await this.repo.obterPerfil(candidato.usuarioId) : null;
    if (!perfil?.visivelParaMatch) return { sugestaoId, notificadas: 0, motivo: 'INVISIVEL_PARA_MATCH' as const };

    const notificadas = await this.notificarEmpresa(vaga, 'MATCH_FORTE', {
      dados: { sugestaoId, candidatoId: sugestao.candidatoId },
      compatibilidade: sugestao.compatibilidade,
      chave: (usuarioId) => chaveDedup({ tipo: 'MATCH_FORTE', usuarioId, vagaId: vaga.id, candidatoId: sugestao.candidatoId }),
    });
    if (notificadas > 0) {
      await this.repo.marcarSugestaoNotificada(sugestaoId, this.relogio.agora(), { empresaId: vaga.empresaId });
    }
    return { sugestaoId, notificadas, motivo: null };
  }

  /** GET /notificacoes — central in-app do usuário (na empresa da sessão, se houver). */
  async listar(sessao: SessaoRequest, consulta: { pagina?: unknown; limite?: unknown }) {
    const pagina = inteiro(consulta.pagina, 1, 1, Number.MAX_SAFE_INTEGER);
    const limite = inteiro(consulta.limite, LIMITE_PADRAO, 1, LIMITE_MAXIMO);
    const resultado = await this.repo.listarNotificacoes(
      { usuarioId: sessao.usuario.id, empresaId: sessao.empresaId ?? undefined, pagina, limite },
      ctxDe(sessao),
    );
    return {
      itens: resultado.itens.map((item) => this.dto(item)),
      pagina,
      limite,
      total: resultado.total,
      naoLidas: resultado.naoLidas,
    };
  }

  async marcarLida(sessao: SessaoRequest, id: string) {
    const lida = await this.repo.marcarNotificacaoLida(id, sessao.usuario.id, this.relogio.agora(), ctxDe(sessao));
    if (!lida) throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'notificação não encontrada');
    return this.dto(lida);
  }

  async marcarTodasLidas(sessao: SessaoRequest) {
    const marcadas = await this.repo.marcarTodasLidas(
      sessao.usuario.id,
      sessao.empresaId ?? undefined,
      this.relogio.agora(),
      ctxDe(sessao),
    );
    return { marcadas };
  }

  async preferencias(sessao: SessaoRequest) {
    const empresaId = this.exigirMembro(sessao);
    const salvas = await this.repo.listarPreferencias(sessao.usuario.id, empresaId, ctxDe(sessao, empresaId));
    return {
      empresaId,
      limiarMatchPlataforma: this.config.matchLimiarForte,
      itens: TIPOS.map((tipo) => {
        const pref = salvas.find((item) => item.tipo === tipo) ?? PREFERENCIA_PADRAO;
        return { tipo, inApp: pref.inApp, push: pref.push, email: pref.email, limiarMatch: pref.limiarMatch };
      }),
    };
  }

  async salvarPreferencias(sessao: SessaoRequest, itens: PreferenciaEntrada[]) {
    const empresaId = this.exigirMembro(sessao);
    const ctx = ctxDe(sessao, empresaId);
    const atuais = await this.repo.listarPreferencias(sessao.usuario.id, empresaId, ctx);
    for (const item of itens) {
      const limiar = item.limiarMatch ?? null;
      if (item.tipo !== 'MATCH_FORTE' && limiar !== null) {
        throw new ErroAplicacao('DADOS_INVALIDOS', 400, 'limiarMatch só vale para MATCH_FORTE');
      }
      if (!limiarPreferenciaValido(limiar)) throw new ErroAplicacao('DADOS_INVALIDOS', 400, 'limiarMatch deve estar em (0, 1]');
    }
    for (const item of itens) {
      const atual: PreferenciaCanais = atuais.find((pref) => pref.tipo === item.tipo) ?? PREFERENCIA_PADRAO;
      await this.repo.salvarPreferencia(
        {
          usuarioId: sessao.usuario.id,
          empresaId,
          tipo: item.tipo,
          inApp: item.inApp ?? atual.inApp,
          push: item.push ?? atual.push,
          email: item.email ?? atual.email,
          limiarMatch: item.limiarMatch === undefined ? atual.limiarMatch : item.limiarMatch,
        },
        ctx,
      );
    }
    return this.preferencias(sessao);
  }

  private async notificarEmpresa(
    vaga: VagaRegistro,
    tipo: TipoNotificacaoEmpresa,
    entrada: { dados: Record<string, unknown>; compatibilidade?: number; chave: (usuarioId: string) => string },
  ): Promise<number> {
    const ctx: ContextoTenant = { empresaId: vaga.empresaId };
    const membros = await this.repo.listarMembros(vaga.empresaId, ctx);
    const destinatarios = membros.filter(
      (membro) => membro.status === 'ATIVO' && membro.papeis.some((papel) => PAPEIS_DESTINATARIOS.has(papel)),
    );
    let notificadas = 0;
    for (const membro of destinatarios) {
      const preferencias = await this.repo.listarPreferencias(membro.usuarioId, vaga.empresaId, ctx);
      const canais = canaisEfetivos(tipo, preferencias.find((item) => item.tipo === tipo) ?? null, {
        compatibilidade: entrada.compatibilidade,
        limiarPlataforma: this.config.matchLimiarForte,
      });
      if (!algumCanal(canais)) continue;
      const nova = {
        id: randomUUID(),
        usuarioId: membro.usuarioId,
        empresaId: vaga.empresaId,
        tipo,
        chaveDedup: entrada.chave(membro.usuarioId),
        dados: { ...entrada.dados, vagaId: vaga.id, vagaTitulo: vaga.titulo, central: canais.inApp },
        criadoEm: this.relogio.agora(),
      };
      const gravada = agrupavel(tipo)
        ? await this.repo.agruparNotificacao(nova, ctx)
        : await this.repo.inserirNotificacaoUnica(nova, ctx);
      if (!gravada) continue;
      notificadas += 1;
      if (decidirAgrupamento(tipo, gravada.agrupadas).entregarFora) await this.entregarFora(gravada, canais);
    }
    return notificadas;
  }

  private async entregarFora(notificacao: NotificacaoRegistro, canais: CanaisNotificacao): Promise<void> {
    for (const canal of this.canais) {
      if (!canais[canal.canal]) continue;
      try {
        await canal.entregar(notificacao);
      } catch (erro) {
        this.logger.warn({ err: erro, notificacaoId: notificacao.id, canal: canal.canal }, 'falha na entrega externa');
      }
    }
  }

  private dto(item: NotificacaoRegistro) {
    const { resumo } = decidirAgrupamento(item.tipo, item.agrupadas);
    const dados = { ...item.dados };
    delete dados.central;
    if (resumo) for (const campo of CAMPOS_INDIVIDUAIS) delete dados[campo];
    return {
      id: item.id,
      tipo: item.tipo,
      empresaId: item.empresaId,
      dados,
      agrupadas: item.agrupadas,
      resumo,
      lida: item.lidaEm !== null,
      lidaEm: item.lidaEm?.toISOString() ?? null,
      criadoEm: item.criadoEm.toISOString(),
    };
  }

  private exigirMembro(sessao: SessaoRequest): string {
    if (!sessao.empresaId || sessao.membro?.status !== 'ATIVO') {
      throw new ErroAplicacao('SEM_PERMISSAO', 403, 'preferências exigem vínculo ativo com a empresa');
    }
    return sessao.empresaId;
  }
}

function inteiro(valor: unknown, padrao: number, minimo: number, maximo: number): number {
  if (valor === undefined || valor === '') return padrao;
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero < minimo || numero > maximo) {
    throw new ErroAplicacao('DADOS_INVALIDOS', 400, 'paginação inválida');
  }
  return numero;
}
