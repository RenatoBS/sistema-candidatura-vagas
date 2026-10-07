import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { triagemTerminal } from '@scv/domain';
import { cifrar } from '@scv/providers';

import type { ConfiguracaoApp } from '../configuracao';
import { ErroAplicacao } from '../erros';
import { RankingService } from '../ranking/ranking.service';
import type { Repositorio } from '../repositorio/tipos';
import { CONFIG, REPOSITORIO } from '../tokens';
import { TriagemOrquestradorService } from '../triagem/triagem-orquestrador.service';
import { WebhookUazapiService } from '../whatsapp/webhook-uazapi.service';
import { gravadorSimulador } from './gravador-whatsapp';

const SISTEMA = { sistema: true as const };

@Injectable()
export class SimuladorEntrevistaService {
  private readonly rankings = new Set<string>();

  constructor(
    @Inject(REPOSITORIO) private readonly repo: Repositorio,
    @Inject(CONFIG) private readonly config: ConfiguracaoApp,
    @Inject(WebhookUazapiService) private readonly webhook: WebhookUazapiService,
    @Inject(TriagemOrquestradorService) private readonly orquestrador: TriagemOrquestradorService,
    @Inject(RankingService) private readonly ranking: RankingService,
  ) {}

  async preparar(numero: string) {
    const { digitos, perfil } = await this.perfilPorNumero(numero);
    const candidatura = await this.candidaturaDo(perfil.id);
    await this.garantirInstancia(candidatura.empresaId);
    const inicio = await this.orquestrador.iniciar(candidatura.id);
    return { ...inicio, numero: digitos, mensagens: this.saidas(digitos) };
  }

  async entrada(corpo: { numero: string; texto: string; botaoId?: string }) {
    const { digitos, perfil } = await this.perfilPorNumero(corpo.numero);
    const { entrevistas } = await this.entrevistasDo(perfil.id);
    const entrevista = [...entrevistas].reverse().find((item) => !triagemTerminal(item.status));
    if (!entrevista) throw new ErroAplicacao('SEM_ENTREVISTA', 404, 'inicie a triagem antes de enviar mensagens');
    const instancia = await this.repo.buscarInstanciaPorEmpresa(entrevista.empresaId, SISTEMA);
    if (!instancia) throw new ErroAplicacao('INSTANCIA_AUSENTE', 404, 'a empresa não tem instância simulada');
    const resultado = await this.webhook.receber(
      instancia.id,
      this.config.uazapiWebhookSecret,
      payloadEntrada(`sim-${randomUUID()}`, digitos, corpo.texto, corpo.botaoId),
    );
    if (this.config.authStore === 'memory' && resultado.status === 'recebido' && 'eventoId' in resultado && resultado.eventoId) {
      await this.orquestrador.processarEvento(resultado.eventoId);
    }
    return { ...resultado, mensagens: this.saidas(digitos) };
  }

  async conversa(numero: string) {
    const { digitos, perfil } = await this.perfilPorNumero(numero);
    const { candidaturas, entrevistas } = await this.entrevistasDo(perfil.id);
    const entrevista = entrevistas.at(-1) ?? null;
    if (entrevista?.status === 'CONCLUIDA' && !this.rankings.has(entrevista.id)) {
      this.rankings.add(entrevista.id);
      const candidatura = candidaturas.find((item) => item.id === entrevista.candidaturaId);
      if (candidatura) {
        try {
          await this.ranking.recalcular(candidatura.vagaId, true);
        } catch {
          this.rankings.delete(entrevista.id);
        }
      }
    }
    return {
      ativo: true,
      numero: digitos,
      nome: perfil.nome,
      entrevista: entrevista
        ? { id: entrevista.id, status: entrevista.status, candidaturaId: entrevista.candidaturaId }
        : null,
      mensagens: this.saidas(digitos),
      avaliacoes: entrevista ? await this.notas(entrevista.id) : [],
    };
  }

  private saidas(digitos: string) {
    return gravadorSimulador.enviados
      .filter((item) => String(item.numero ?? '').replace(/\D/g, '') === digitos)
      .map((item) => ({
        id: String(item.mensagemIdProvedor ?? ''),
        tipo: String(item.tipo ?? 'texto'),
        texto: String(item.texto ?? ''),
        opcoes: Array.isArray(item.opcoes)
          ? item.opcoes.flatMap((opcao) => {
              if (!opcao || typeof opcao !== 'object') return [];
              const registro = opcao as { id?: unknown; titulo?: unknown };
              if (typeof registro.id !== 'string' || typeof registro.titulo !== 'string') return [];
              return [{ id: registro.id, titulo: registro.titulo }];
            })
          : [],
      }));
  }

  private async notas(entrevistaId: string) {
    const respostas = await this.repo.listarRespostasEntrevista(entrevistaId, SISTEMA);
    const itens = [];
    for (const resposta of respostas) {
      const avaliacoes = await this.repo.listarAvaliacoes(resposta.id, SISTEMA);
      const ia = avaliacoes.find((item) => item.avaliador === 'IA');
      if (!ia) continue;
      itens.push({
        nota: ia.nota,
        justificativa: ia.justificativa,
        trecho: (resposta.transcricao ?? resposta.textoOriginal ?? '').slice(0, 140),
      });
    }
    return itens;
  }

  private async perfilPorNumero(numero: string) {
    const digitos = numero.replace(/\D/g, '');
    if (digitos.length < 8) throw new ErroAplicacao('NUMERO_INVALIDO', 400, 'informe o telefone com DDD');
    const perfil = await this.repo.buscarPerfilPorWhatsapp(digitos);
    if (!perfil) throw new ErroAplicacao('CANDIDATO_NAO_ENCONTRADO', 404, 'nenhum candidato com esse telefone');
    return { digitos, perfil };
  }

  private async candidaturaDo(candidatoId: string) {
    const lista = await this.repo.listarCandidaturasCandidato(candidatoId, SISTEMA);
    const abertas = lista.filter((item) => item.status === 'INSCRITA' || item.status === 'TRIAGEM_WHATSAPP');
    const maisRecente = (itens: typeof lista) =>
      [...itens].sort((a, b) => b.criadoEm.getTime() - a.criadoEm.getTime())[0];
    const preferida = maisRecente(abertas) ?? maisRecente(lista);
    if (!preferida) throw new ErroAplicacao('SEM_CANDIDATURA', 404, 'o candidato ainda não se candidatou');
    return preferida;
  }

  private async entrevistasDo(candidatoId: string) {
    const candidaturas = await this.repo.listarCandidaturasCandidato(candidatoId, SISTEMA);
    const ids = new Set(candidaturas.map((item) => item.id));
    const entrevistas = (await this.repo.listarEntrevistas(SISTEMA))
      .filter((item) => ids.has(item.candidaturaId) && item.canal === 'WHATSAPP')
      .sort((a, b) => a.atualizadoEm.getTime() - b.atualizadoEm.getTime());
    return { candidaturas, entrevistas };
  }

  private async garantirInstancia(empresaId: string) {
    if (!this.config.encryptionKey) {
      throw new ErroAplicacao('CRIPTOGRAFIA_AUSENTE', 500, 'APP_ENCRYPTION_KEY não configurada');
    }
    const agora = new Date();
    const atual = await this.repo.buscarInstanciaPorEmpresa(empresaId, SISTEMA);
    if (atual?.status === 'CONECTADA') return atual;
    const base = atual ?? {
      id: randomUUID(),
      empresaId,
      instanciaIdProvedorCifrado: cifrar(`sim-${empresaId}`, this.config.encryptionKey),
      tokenCifrado: cifrar(`sim-token-${empresaId}`, this.config.encryptionKey),
      numero: '5511900001111',
      status: 'CONECTADA' as const,
      ultimaConexaoEm: agora,
      desconectadaEm: null,
    };
    return this.repo.salvarInstancia(
      {
        ...base,
        status: 'CONECTADA',
        numero: base.numero ?? '5511900001111',
        ultimaConexaoEm: agora,
        desconectadaEm: null,
      },
      { empresaId, sistema: true },
    );
  }
}

function payloadEntrada(id: string, numero: string, texto: string, botaoId?: string) {
  return {
    message: {
      messageid: id,
      sender: `${numero}@s.whatsapp.net`,
      messageType: botaoId ? 'ButtonResponse' : 'Conversation',
      text: texto,
      fromMe: false,
      wasSentByApi: false,
      ...(botaoId ? { buttonOrListid: botaoId } : {}),
    },
  };
}
