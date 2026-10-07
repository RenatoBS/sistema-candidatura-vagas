import 'reflect-metadata';

import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { after, before, beforeEach, describe, it } from 'node:test';

import type { INestApplication } from '@nestjs/common';
import { EFEITOS_EVENTO_VAGA, type TipoEventoVaga } from '@scv/domain';

process.env.NODE_ENV = 'test';
process.env.AUTH_STORE = 'memory';
process.env.JWT_SECRET = 'segredo-de-teste-com-32-bytes!!';
process.env.APP_ENCRYPTION_KEY = randomBytes(32).toString('base64');
process.env.INTERNAL_JOB_TOKEN = 'job-teste';
process.env.API_PUBLIC_URL = 'http://localhost:3000';
process.env.LOG_LEVEL = 'silent';
process.env.LLM_PROVIDER = 'mock';

import { limparAmbienteTeste, relogioTeste, repositorioTeste } from '../src/ambiente-teste';
import { CandidaturaStateMachine } from '../src/candidaturas/candidatura-state-machine';
import type { ContextoTenant, VagaRegistro } from '../src/repositorio/tipos';

const AGORA = new Date('2026-10-06T15:00:00.000Z');

let base = '';
let app: INestApplication | null = null;

async function aplicarEvento(eventoId: string) {
  const resposta = await fetch(`${base}/interno/eventos-vaga/${eventoId}/aplicar`, {
    method: 'POST',
    headers: { 'x-internal-token': 'job-teste' },
  });
  return { status: resposta.status, json: (await resposta.json()) as Record<string, unknown> };
}

async function vaga(empresaId: string): Promise<VagaRegistro> {
  return repositorioTeste.criarVaga(
    {
      id: randomUUID(),
      empresaId,
      titulo: 'Analista de dados',
      descricao: 'Vaga de teste',
      senioridade: 'PLENO',
      modelo: 'REMOTO',
      localidade: null,
      tipoContrato: null,
      faixaSalarialMin: null,
      faixaSalarialMax: null,
      beneficios: [],
      posicoes: 1,
      status: 'PUBLICADA',
      prazoInscricoes: new Date('2026-11-21T02:59:00.000Z'),
      inscricoesEncerradasEm: null,
      pausadaEm: null,
      statusAntesDaPausa: null,
      fechadaEm: null,
      motivoFechamento: null,
      alertaPausaEm: null,
      criadoEm: AGORA,
      atualizadoEm: AGORA,
    },
    { sistema: true },
  );
}

async function evento(alvo: VagaRegistro, tipo: TipoEventoVaga, motivo: string | null = null): Promise<string> {
  const registrado = await repositorioTeste.registrarEventoVaga(
    {
      id: randomUUID(),
      empresaId: alvo.empresaId,
      vagaId: alvo.id,
      tipo,
      payload: { tipo, vagaId: alvo.id, empresaId: alvo.empresaId, motivo, efeitos: [...EFEITOS_EVENTO_VAGA[tipo]] },
      criadoEm: relogioTeste.agora(),
      consumidoEm: null,
    },
    { sistema: true },
  );
  return registrado.id;
}

describe('Fase 6 — CandidaturaStateMachine e eventos de vaga', () => {
  before(async () => {
    const { NestFactory } = await import('@nestjs/core');
    const { AppModule } = await import('../src/app.module');
    const { FiltroErros } = await import('../src/http/filtro-erros');
    app = await NestFactory.create(AppModule, { logger: false });
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new FiltroErros());
    await app.listen(0);
    base = `${await app.getUrl()}/api/v1`;
  });

  after(async () => {
    await app?.close();
  });

  beforeEach(() => {
    limparAmbienteTeste();
    relogioTeste.definir(AGORA);
  });

  it('VagaPausada põe candidaturas ativas em espera; retomada e fechamento seguem o histórico', async () => {
    const maquina = app!.get(CandidaturaStateMachine);
    const empresaId = randomUUID();
    const ctx: ContextoTenant = { empresaId };
    const alvo = await vaga(empresaId);
    const outra = await vaga(empresaId);
    const nova = (vagaId: string) => ({ empresaId, vagaId, candidatoId: randomUUID(), origem: 'DIRETA' as const });
    const direta = { tipo: 'candidatarDireta' as const, vagaAceitaInscricoes: true };

    const inscrita = await maquina.criar(nova(alvo.id), direta, { autorId: null }, ctx);
    const triagem = await maquina.criar(nova(alvo.id), direta, { autorId: null }, ctx);
    await maquina.aplicar(triagem.id, { tipo: 'iniciarTriagem' }, { autorId: null }, ctx);
    const desistente = await maquina.criar(nova(alvo.id), direta, { autorId: null }, ctx);
    await maquina.aplicar(desistente.id, { tipo: 'desistir' }, { autorId: null, motivo: 'pedido do candidato' }, ctx);
    const deOutraVaga = await maquina.criar(nova(outra.id), direta, { autorId: null }, ctx);

    const pausa = await aplicarEvento(await evento(alvo, 'VagaPausada'));
    assert.equal(pausa.status, 201, JSON.stringify(pausa.json));
    assert.deepEqual(pausa.json.candidaturas, { aplicadas: 2, ignoradas: 1 });

    const status = async (id: string) => (await repositorioTeste.buscarCandidatura(id, ctx))!;
    assert.equal((await status(inscrita.id)).status, 'EM_ESPERA');
    assert.equal((await status(inscrita.id)).statusAntesDaEspera, 'INSCRITA');
    assert.equal((await status(triagem.id)).status, 'EM_ESPERA');
    assert.equal((await status(triagem.id)).statusAntesDaEspera, 'TRIAGEM_WHATSAPP');
    assert.equal((await status(desistente.id)).status, 'DESISTENCIA');
    assert.equal((await status(deOutraVaga.id)).status, 'INSCRITA');

    const historico = await repositorioTeste.listarHistoricoStatus(triagem.id, ctx);
    assert.deepEqual(
      historico.map((item) => [item.de, item.para, item.autorId, item.motivo]),
      [
        ['NOVA', 'INSCRITA', null, null],
        ['INSCRITA', 'TRIAGEM_WHATSAPP', null, null],
        ['TRIAGEM_WHATSAPP', 'EM_ESPERA', null, 'vaga pausada'],
      ],
    );

    // Evento de pausa reprocessado não duplica efeitos.
    const repetido = await evento(alvo, 'VagaPausada');
    assert.deepEqual((await aplicarEvento(repetido)).json.candidaturas, { aplicadas: 0, ignoradas: 3 });

    const retomada = await aplicarEvento(await evento(alvo, 'VagaRetomada'));
    assert.deepEqual(retomada.json.candidaturas, { aplicadas: 2, ignoradas: 1 });
    assert.equal((await status(inscrita.id)).status, 'INSCRITA');
    assert.equal((await status(triagem.id)).status, 'TRIAGEM_WHATSAPP');
    assert.equal((await status(triagem.id)).statusAntesDaEspera, null);

    await maquina.aplicar(triagem.id, { tipo: 'concluirTriagem' }, { autorId: null }, ctx);
    await maquina.aplicar(triagem.id, { tipo: 'enviarRevisao' }, { autorId: null }, ctx);
    const semHumano = await maquina
      .aplicar(triagem.id, { tipo: 'reprovar', autorHumanoId: '' }, { autorId: null }, ctx)
      .catch((erro: { codigo?: string }) => erro.codigo);
    assert.equal(semHumano, 'DECISAO_HUMANA_OBRIGATORIA');

    const fechamento = await aplicarEvento(await evento(alvo, 'VagaFechada', 'posição preenchida'));
    assert.deepEqual(fechamento.json.candidaturas, { aplicadas: 2, ignoradas: 1 });
    assert.equal((await status(inscrita.id)).status, 'ENCERRADA_VAGA_FECHADA');
    assert.equal((await status(triagem.id)).status, 'ENCERRADA_VAGA_FECHADA');
    assert.equal((await status(desistente.id)).status, 'DESISTENCIA');
    const ultimo = (await repositorioTeste.listarHistoricoStatus(triagem.id, ctx)).at(-1)!;
    assert.deepEqual([ultimo.de, ultimo.para, ultimo.motivo], ['EM_REVISAO', 'ENCERRADA_VAGA_FECHADA', 'vaga fechada: posição preenchida']);
  });

  it('controle otimista rejeita gravação com estado desatualizado', async () => {
    const maquina = app!.get(CandidaturaStateMachine);
    const empresaId = randomUUID();
    const ctx: ContextoTenant = { empresaId };
    const alvo = await vaga(empresaId);
    const criada = await maquina.criar(
      { empresaId, vagaId: alvo.id, candidatoId: randomUUID(), origem: 'DIRETA' },
      { tipo: 'candidatarDireta', vagaAceitaInscricoes: true },
      { autorId: null },
      ctx,
    );
    await maquina.aplicar(criada.id, { tipo: 'iniciarTriagem' }, { autorId: null }, ctx);
    const atrasada = await repositorioTeste.transicionarCandidatura(
      {
        candidaturaId: criada.id,
        esperado: { status: criada.status, atualizadoEm: criada.atualizadoEm },
        proximo: { status: 'DESISTENCIA', statusAntesDaEspera: null, atualizadoEm: AGORA },
        historico: {
          id: randomUUID(),
          candidaturaId: criada.id,
          de: criada.status,
          para: 'DESISTENCIA',
          autorId: null,
          motivo: null,
          criadoEm: AGORA,
        },
      },
      ctx,
    );
    assert.equal(atrasada, null);
    assert.equal((await repositorioTeste.buscarCandidatura(criada.id, ctx))!.status, 'TRIAGEM_WHATSAPP');
    assert.equal((await repositorioTeste.listarHistoricoStatus(criada.id, ctx)).length, 2);
    // Candidatura de outra empresa não é visível.
    assert.equal(await repositorioTeste.buscarCandidatura(criada.id, { empresaId: randomUUID() }), null);
  });
});
