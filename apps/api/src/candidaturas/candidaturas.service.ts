import { randomUUID } from 'node:crypto';

import { aceitaInscricoes, rotuloAmigavel, VERSAO_TERMOS_ATUAL, type TipoConsentimento } from '@scv/domain';

import type { Relogio } from '../auth/auth.service';
import { ErroAplicacao } from '../erros';
import type { NotificacoesService } from '../notificacoes/notificacoes.service';
import type { Repositorio } from '../repositorio/tipos';
import { ctxDe, type SessaoRequest } from '../sessao';
import { CandidaturaStateMachine } from './candidatura-state-machine';

export interface ConsentimentoEntrada { tipo: TipoConsentimento; concedido: boolean; versaoTermo: string }

export class CandidaturasService {
  constructor(private readonly repo: Repositorio, private readonly maquina: CandidaturaStateMachine, private readonly relogio: Relogio, private readonly notificacoes?: NotificacoesService) {}

  async criar(sessao: SessaoRequest, vagaId: string, entradas: ConsentimentoEntrada[]) {
    const candidato = await this.repo.buscarCandidatoPorUsuario(sessao.usuario.id);
    if (!candidato) throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'candidato não encontrado');
    const vaga = await this.repo.buscarVaga(vagaId, { sistema: true });
    if (!vaga || !aceitaInscricoes(vaga, this.relogio.agora())) throw new ErroAplicacao('INSCRICOES_INDISPONIVEIS', 409, 'inscrições não disponíveis');
    if (!entradas.some((item) => item.tipo === 'TERMOS' && item.concedido)) throw new ErroAplicacao('CONSENTIMENTO_OBRIGATORIO', 400, 'consentimento de termos obrigatório');
    const candidatura = await this.maquina.criar({ empresaId: vaga.empresaId, vagaId, candidatoId: candidato.id, origem: 'DIRETA' }, { tipo: 'candidatarDireta', vagaAceitaInscricoes: true }, { autorId: candidato.id }, { empresaId: vaga.empresaId });
    for (const entrada of entradas) {
      await this.repo.registrarConsentimento({ id: randomUUID(), candidatoId: candidato.id, candidaturaId: candidatura.id, tipo: entrada.tipo, concedido: entrada.concedido, versaoTermo: entrada.versaoTermo || VERSAO_TERMOS_ATUAL, criadoEm: this.relogio.agora() });
    }
    await this.notificacoes?.candidatoNovo(candidatura);
    return this.dto(candidatura);
  }

  async minhas(sessao: SessaoRequest) {
    const candidato = await this.repo.buscarCandidatoPorUsuario(sessao.usuario.id);
    if (!candidato) throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'candidato não encontrado');
    return (await this.repo.listarCandidaturasCandidato(candidato.id, { sistema: true })).map((item) => this.dto(item));
  }

  async minha(sessao: SessaoRequest, id: string) {
    const item = (await this.minhas(sessao)).find((candidatura) => candidatura.id === id);
    if (!item) throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'candidatura não encontrada');
    return item;
  }

  async convidar(sessao: SessaoRequest, vagaId: string, sugestaoId: string) {
    const vaga = await this.repo.buscarVaga(vagaId, ctxDe(sessao));
    if (!vaga) throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'vaga não encontrada');
    if (!aceitaInscricoes(vaga, this.relogio.agora())) throw new ErroAplicacao('INSCRICOES_INDISPONIVEIS', 409, 'inscrições não disponíveis');
    const sugestao = await this.repo.buscarSugestao(sugestaoId, ctxDe(sessao, vaga.empresaId));
    if (!sugestao || sugestao.vagaId !== vagaId) throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'sugestão não encontrada');
    const candidatura = await this.maquina.criar(
      { empresaId: vaga.empresaId, vagaId, candidatoId: sugestao.candidatoId, origem: 'MATCH' },
      { tipo: 'convidar', vagaAceitaInscricoes: true }, { autorId: sessao.usuario.id }, { empresaId: vaga.empresaId },
    );
    await this.repo.atualizarStatusSugestao(sugestaoId, 'CONVIDADA', { empresaId: vaga.empresaId });
    return this.dto(candidatura);
  }

  async convites(sessao: SessaoRequest) {
    const candidato = await this.repo.buscarCandidatoPorUsuario(sessao.usuario.id);
    if (!candidato) throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'candidato não encontrado');
    const candidaturas = await this.repo.listarCandidaturasCandidato(candidato.id, { sistema: true });
    const pendentes = candidaturas.filter((item) => item.status === 'CONVIDADA');
    const itens = [];
    for (const item of pendentes) {
      const vaga = await this.repo.buscarVaga(item.vagaId, { sistema: true });
      if (vaga) itens.push({ id: item.id, vaga: { id: vaga.id, titulo: vaga.titulo, senioridade: vaga.senioridade, modelo: vaga.modelo, localidade: vaga.localidade, prazoInscricoes: vaga.prazoInscricoes?.toISOString() ?? null } });
    }
    return { convites: itens };
  }

  async aceitarConvite(sessao: SessaoRequest, id: string, entradas: ConsentimentoEntrada[]) {
    const candidato = await this.repo.buscarCandidatoPorUsuario(sessao.usuario.id);
    if (!candidato) throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'candidato não encontrado');
    const atual = await this.repo.buscarCandidatura(id, { sistema: true });
    if (!atual || atual.candidatoId !== candidato.id) throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'convite não encontrado');
    const vaga = await this.repo.buscarVaga(atual.vagaId, { sistema: true });
    if (!vaga || !aceitaInscricoes(vaga, this.relogio.agora())) {
      if (atual.status === 'CONVIDADA') await this.maquina.aplicar(id, { tipo: 'expirarConvite' }, { autorId: null }, { empresaId: atual.empresaId });
      await this.repo.atualizarStatusSugestao((await this.repo.listarSugestoesVaga(atual.vagaId, { empresaId: atual.empresaId })).find((s) => s.candidatoId === atual.candidatoId)?.id ?? '', 'EXPIRADA', { empresaId: atual.empresaId });
      throw new ErroAplicacao('INSCRICOES_INDISPONIVEIS', 409, 'convite expirado: inscrições não disponíveis');
    }
    if (!entradas.some((item) => item.tipo === 'TERMOS' && item.concedido)) throw new ErroAplicacao('CONSENTIMENTO_OBRIGATORIO', 400, 'consentimento de termos obrigatório');
    const candidatura = await this.maquina.aplicar(id, { tipo: 'aceitarConvite', vagaAceitaInscricoes: true }, { autorId: candidato.id }, { empresaId: atual.empresaId });
    for (const entrada of entradas) await this.repo.registrarConsentimento({ id: randomUUID(), candidatoId: candidato.id, candidaturaId: id, tipo: entrada.tipo, concedido: entrada.concedido, versaoTermo: entrada.versaoTermo || VERSAO_TERMOS_ATUAL, criadoEm: this.relogio.agora() });
    const sugestao = (await this.repo.listarSugestoesVaga(atual.vagaId, { empresaId: atual.empresaId })).find((s) => s.candidatoId === atual.candidatoId);
    if (sugestao) await this.repo.atualizarStatusSugestao(sugestao.id, 'ACEITA', { empresaId: atual.empresaId });
    await this.notificacoes?.candidatoNovo(candidatura);
    return this.dto(candidatura);
  }

  async recusarConvite(sessao: SessaoRequest, id: string) {
    const candidato = await this.repo.buscarCandidatoPorUsuario(sessao.usuario.id);
    const atual = candidato ? await this.repo.buscarCandidatura(id, { sistema: true }) : null;
    if (!candidato || !atual || atual.candidatoId !== candidato.id) throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'convite não encontrado');
    const candidatura = await this.maquina.aplicar(id, { tipo: 'recusarConvite' }, { autorId: candidato.id }, { empresaId: atual.empresaId });
    const sugestao = (await this.repo.listarSugestoesVaga(atual.vagaId, { empresaId: atual.empresaId })).find((s) => s.candidatoId === atual.candidatoId);
    if (sugestao) await this.repo.atualizarStatusSugestao(sugestao.id, 'RECUSADA', { empresaId: atual.empresaId });
    return this.dto(candidatura);
  }

  async daVaga(sessao: SessaoRequest, vagaId: string) {
    const vaga = await this.repo.buscarVaga(vagaId, ctxDe(sessao));
    if (!vaga) throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'vaga não encontrada');
    const itens = await this.repo.listarCandidaturasVaga(vagaId, ctxDe(sessao, vaga.empresaId));
    return Promise.all(itens.map(async (item) => ({ ...this.dto(item), candidato: (await this.repo.buscarCandidatoPorId(item.candidatoId))?.nome ?? 'Candidato' })));
  }

  private dto(item: { id: string; vagaId: string; origem: string; status: any; etapaAtualId: string | null; criadoEm: Date; atualizadoEm: Date }) {
    return { id: item.id, vagaId: item.vagaId, origem: item.origem, status: item.status, fase: rotuloAmigavel(item.status), etapaAtualId: item.etapaAtualId, criadoEm: item.criadoEm, atualizadoEm: item.atualizadoEm };
  }
}
