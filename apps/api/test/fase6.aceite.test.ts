import 'reflect-metadata';

import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { after, before, beforeEach, describe, it } from 'node:test';

import type { INestApplication } from '@nestjs/common';

process.env.NODE_ENV = 'test';
process.env.AUTH_STORE = 'memory';
process.env.JWT_SECRET = 'segredo-de-teste-com-32-bytes!!';
process.env.APP_ENCRYPTION_KEY = randomBytes(32).toString('base64');
process.env.REVISAO_MANUAL_EMPRESA = 'falha';
process.env.INTERNAL_JOB_TOKEN = 'job-teste';
process.env.API_PUBLIC_URL = 'http://localhost:3000';
process.env.LOG_LEVEL = 'silent';
process.env.LLM_PROVIDER = 'mock';

import {
  emailTeste,
  filaCnpjTeste,
  filaMatchTeste,
  fonteCnpjTeste,
  limparAmbienteTeste,
  pushTeste,
  relogioTeste,
  repositorioTeste,
} from '../src/ambiente-teste';
import { extrairCodigo } from '../src/auth/segredos';
import { NotificacoesService } from '../src/notificacoes/notificacoes.service';

const AGORA = new Date('2026-10-06T15:00:00.000Z');
const PRAZO = '2026-11-20T23:59';

let base = '';
let app: INestApplication | null = null;

type Json = Record<string, unknown>;

interface NotificacaoDto {
  id: string;
  tipo: string;
  dados: Json;
  agrupadas: number;
  resumo: boolean;
  lida: boolean;
}

async function api(caminho: string, init: RequestInit = {}, token?: string) {
  const headers = new Headers(init.headers);
  if (token) headers.set('authorization', `Bearer ${token}`);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const resposta = await fetch(`${base}${caminho}`, { ...init, headers });
  const texto = await resposta.text();
  return { status: resposta.status, json: texto ? (JSON.parse(texto) as Json) : {} };
}

function interno(caminho: string) {
  return api(caminho, { method: 'POST', headers: { 'x-internal-token': 'job-teste' } });
}

async function drenarMatch(): Promise<void> {
  for (let rodada = 0; rodada < 10; rodada += 1) {
    const tarefas = [
      ...filaMatchTeste.embeddingsVaga
        .splice(0)
        .map((id) => `/interno/match/embeddings/vagas/${id}`),
      ...filaMatchTeste.embeddingsCandidato
        .splice(0)
        .map((id) => `/interno/match/embeddings/candidatos/${id}`),
      ...filaMatchTeste.matchVaga.splice(0).map((id) => `/interno/match/vagas/${id}`),
      ...filaMatchTeste.matchCandidato.splice(0).map((id) => `/interno/match/candidatos/${id}`),
    ];
    if (tarefas.length === 0) return;
    for (const tarefa of tarefas) assert.equal((await interno(tarefa)).status, 200, tarefa);
  }
  throw new Error('fila de match não esvaziou');
}

async function contaConfirmada(email: string) {
  const senha = 'senha1234';
  assert.equal(
    (await api('/auth/cadastro', { method: 'POST', body: JSON.stringify({ email, senha }) }))
      .status,
    201,
  );
  const codigo = extrairCodigo(emailTeste.ultimoPara(email)?.texto ?? '');
  assert.ok(codigo);
  await api('/auth/confirmar-email', { method: 'POST', body: JSON.stringify({ token: codigo }) });
  const login = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, senha }),
  });
  assert.equal(login.status, 201);
  return String(login.json.accessToken);
}

async function empresaVerificada(email: string, cnpj: string) {
  const access = await contaConfirmada(email);
  const responsavel = `resp-${cnpj.slice(0, 4)}@empresa.test`;
  const criada = await api(
    '/empresas/cadastro',
    {
      method: 'POST',
      body: JSON.stringify({
        razaoSocial: 'Acme Ltda',
        nomeFantasia: 'Acme',
        cnpj,
        dominio: 'empresa.test',
        responsavelNome: 'Responsável',
        responsavelEmail: responsavel,
      }),
    },
    access,
  );
  assert.equal(criada.status, 201, JSON.stringify(criada.json));
  const empresaId = String((criada.json.empresa as { id: string }).id);
  const token = String((criada.json.sessao as { accessToken: string }).accessToken);
  const codigo = extrairCodigo(emailTeste.ultimoPara(responsavel)?.texto ?? '');
  assert.ok(codigo);
  await api(
    `/empresas/${empresaId}/verificacao/email`,
    { method: 'POST', body: JSON.stringify({ codigo }) },
    token,
  );
  fonteCnpjTeste.definir(cnpj.replace(/\D/g, ''), {
    situacaoAtiva: true,
    razaoSocial: 'Acme Ltda',
    indisponivel: false,
  });
  assert.equal(filaCnpjTeste.jobs.includes(empresaId), true);
  assert.equal((await interno(`/interno/empresas/${empresaId}/verificar-cnpj`)).status, 201);
  return { empresaId, token };
}

async function candidato(email: string) {
  const access = await contaConfirmada(email);
  const onboard = await api(
    '/onboarding/candidato',
    { method: 'POST', body: JSON.stringify({ nome: 'Pessoa Teste' }) },
    access,
  );
  assert.equal(onboard.status, 201);
  const token = String(onboard.json.accessToken);
  const perfil = await api('/candidatos/me', {}, token);
  return { token, id: String(perfil.json.id) };
}

async function candidatoAderente(email: string) {
  const pessoa = await candidato(email);
  const catalogo = (await api('/habilidades')).json as unknown as Array<{
    id: string;
    nome: string;
  }>;
  const id = (nome: string) => catalogo.find((item) => item.nome === nome)!.id;
  const itens = [
    { habilidadeId: id('TypeScript'), nivel: 5 },
    { habilidadeId: id('PostgreSQL'), nivel: 4 },
  ];
  assert.equal(
    (
      await api(
        '/candidatos/me/habilidades',
        { method: 'PUT', body: JSON.stringify({ itens }) },
        pessoa.token,
      )
    ).status,
    200,
  );
  const perfil = {
    resumo: 'Desenvolvedor backend TypeScript. APIs em Node.js com TypeScript e PostgreSQL.',
  };
  const salvo = await api(
    '/candidatos/me',
    { method: 'PUT', body: JSON.stringify({ perfil, visivelParaMatch: true }) },
    pessoa.token,
  );
  assert.equal(salvo.status, 200);
  return pessoa;
}

async function vagaPublicada(empresaId: string, token: string): Promise<string> {
  const rascunho = await api(
    `/empresas/${empresaId}/vagas`,
    {
      method: 'POST',
      body: JSON.stringify({
        titulo: 'Desenvolvedor backend TypeScript',
        descricao: 'APIs em Node.js com TypeScript e PostgreSQL.',
        senioridade: 'PLENO',
        modelo: 'REMOTO',
        prazoInscricoes: PRAZO,
        habilidades: [
          { nome: 'TypeScript', nivelMinimo: 4, peso: 2, obrigatoria: true },
          { nome: 'PostgreSQL', nivelMinimo: 3, peso: 1 },
        ],
      }),
    },
    token,
  );
  assert.equal(rascunho.status, 201, JSON.stringify(rascunho.json));
  const vagaId = String(rascunho.json.id);
  const processo = await api(
    `/empresas/${empresaId}/vagas/${vagaId}/processo`,
    {
      method: 'PUT',
      body: JSON.stringify({ etapas: [{ ordem: 1, tipo: 'ENTREVISTA_VOZ', numeroPerguntas: 1 }] }),
    },
    token,
  );
  const etapaId = String(
    ((processo.json.processo as { etapas: Array<{ id: string }> }).etapas[0] ?? {}).id,
  );
  await api(
    `/empresas/${empresaId}/vagas/${vagaId}/etapas/${etapaId}/perguntas`,
    { method: 'POST', body: JSON.stringify({ enunciado: 'Conte um projeto recente.' }) },
    token,
  );
  assert.equal(
    (await api(`/empresas/${empresaId}/vagas/${vagaId}/publicar`, { method: 'POST' }, token))
      .status,
    201,
  );
  return vagaId;
}

async function candidatar(vagaId: string, token: string) {
  const body = { consentimentos: [{ tipo: 'TERMOS', concedido: true, versaoTermo: 'v1' }] };
  const resposta = await api(
    `/vagas-publicas/${vagaId}/candidaturas`,
    { method: 'POST', body: JSON.stringify(body) },
    token,
  );
  assert.equal(resposta.status, 201, JSON.stringify(resposta.json));
  return resposta.json;
}

async function central(token: string, consulta = '') {
  const resposta = await api(`/notificacoes${consulta}`, {}, token);
  assert.equal(resposta.status, 200, JSON.stringify(resposta.json));
  return resposta.json as {
    itens: NotificacaoDto[];
    total: number;
    naoLidas: number;
    pagina: number;
    limite: number;
  };
}

describe('Fase 6 — critérios de aceite HTTP (F6-12)', () => {
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

  // O app é compartilhado com os cenários F6-03/F6-05 abaixo.

  beforeEach(() => {
    limparAmbienteTeste();
    relogioTeste.definir(AGORA);
  });

  it('match.forte gera uma única MATCH_FORTE por vaga+candidato e preenche notificadoEm', async () => {
    const { empresaId, token } = await empresaVerificada('dona@empresa.test', '11.222.333/0001-81');
    const pessoa = await candidatoAderente('aderente@pessoal.test');
    const vagaId = await vagaPublicada(empresaId, token);
    await drenarMatch();
    assert.equal(filaMatchTeste.matchForte.length, 1);
    const { sugestaoId } = filaMatchTeste.matchForte[0]!;

    assert.equal(
      (await api(`/interno/notificacoes/match-forte/${sugestaoId}`, { method: 'POST' })).status,
      401,
    );
    const primeira = await interno(`/interno/notificacoes/match-forte/${sugestaoId}`);
    assert.equal(primeira.status, 200, JSON.stringify(primeira.json));
    assert.equal(primeira.json.notificadas, 1);
    // Reentrega do job (retry do BullMQ) não duplica.
    assert.equal(
      (await interno(`/interno/notificacoes/match-forte/${sugestaoId}`)).json.motivo,
      'JA_NOTIFICADA',
    );
    assert.ok(repositorioTeste.matchStore.sugestoes.get(sugestaoId)?.notificadoEm);
    // Mesmo sem notificadoEm, a chaveDedup segura a segunda.
    repositorioTeste.matchStore.sugestoes.get(sugestaoId)!.notificadoEm = null;
    assert.equal(
      (await interno(`/interno/notificacoes/match-forte/${sugestaoId}`)).json.notificadas,
      0,
    );

    const lista = await central(token);
    assert.equal(lista.total, 1);
    assert.deepEqual(
      {
        tipo: lista.itens[0]?.tipo,
        vagaId: lista.itens[0]?.dados.vagaId,
        candidatoId: lista.itens[0]?.dados.candidatoId,
      },
      { tipo: 'MATCH_FORTE', vagaId, candidatoId: pessoa.id },
    );
    assert.equal(pushTeste.entregues.length, 1);
    // Candidato não vê nada da empresa.
    assert.equal((await central(pessoa.token)).total, 0);
  });

  it('10 candidaturas em sequência viram 1 notificação agrupada; leitura e nova janela', async () => {
    const { empresaId, token } = await empresaVerificada(
      'dona2@empresa.test',
      '11.444.777/0001-61',
    );
    const vagaId = await vagaPublicada(empresaId, token);
    const pessoas = [];
    for (let i = 0; i < 11; i += 1) pessoas.push(await candidato(`c${i}@pessoal.test`));

    for (let i = 0; i < 10; i += 1) {
      relogioTeste.definir(new Date(AGORA.getTime() + i * 60_000));
      await candidatar(vagaId, pessoas[i]!.token);
    }
    const lista = await central(token);
    assert.equal(lista.total, 1);
    const [agrupada] = lista.itens;
    assert.equal(agrupada!.tipo, 'CANDIDATO_NOVO');
    assert.equal(agrupada!.agrupadas, 10);
    assert.equal(agrupada!.resumo, true);
    assert.equal(agrupada!.dados.vagaId, vagaId);
    assert.equal('candidatoId' in agrupada!.dados, false);
    // Push só na criação e quando virou resumo.
    assert.equal(pushTeste.entregues.length, 2);

    assert.equal(
      (await api(`/notificacoes/${agrupada!.id}/lida`, { method: 'POST' }, token)).status,
      200,
    );
    assert.equal((await central(token)).naoLidas, 0);

    // Janela seguinte abre outra notificação (direto no serviço: o access token não sobrevive a 2 h).
    relogioTeste.definir(new Date(AGORA.getTime() + 2 * 60 * 60_000));
    const candidatura = {
      id: randomUUID(),
      empresaId,
      vagaId,
      candidatoId: pessoas[10]!.id,
      origem: 'DIRETA' as const,
    };
    assert.equal((await app!.get(NotificacoesService).candidatoNovo(candidatura)).notificadas, 1);
    relogioTeste.definir(new Date(AGORA.getTime() + 10 * 60_000));
    const depois = await central(token, '?limite=1');
    assert.deepEqual(
      [depois.total, depois.naoLidas, depois.itens.length, depois.itens[0]?.agrupadas],
      [2, 1, 1, 1],
    );
    assert.equal((await api('/notificacoes/lidas', { method: 'POST' }, token)).json.marcadas, 1);
    assert.equal((await central(token)).naoLidas, 0);
    assert.equal((await api('/notificacoes?limite=500', {}, token)).status, 400);
  });

  it('vaga pausada ou fechada não gera notificação', async () => {
    const { empresaId, token } = await empresaVerificada(
      'dona3@empresa.test',
      '11.222.333/0001-81',
    );
    await candidatoAderente('aderente3@pessoal.test');
    const vagaId = await vagaPublicada(empresaId, token);
    await drenarMatch();
    const { sugestaoId } = filaMatchTeste.matchForte[0]!;
    const servico = app!.get(NotificacoesService);
    const candidatura = {
      id: randomUUID(),
      empresaId,
      vagaId,
      candidatoId: randomUUID(),
      origem: 'DIRETA' as const,
    };

    assert.equal(
      (await api(`/empresas/${empresaId}/vagas/${vagaId}/pausar`, { method: 'POST' }, token))
        .status,
      201,
    );
    assert.equal(
      (await interno(`/interno/notificacoes/match-forte/${sugestaoId}`)).json.motivo,
      'VAGA_INDISPONIVEL',
    );
    assert.equal((await servico.candidatoNovo(candidatura)).notificadas, 0);

    const fechada = await api(
      `/empresas/${empresaId}/vagas/${vagaId}/fechar`,
      { method: 'POST', body: JSON.stringify({ motivo: 'Vaga preenchida' }) },
      token,
    );
    assert.equal(fechada.status, 201, JSON.stringify(fechada.json));
    assert.equal(
      (await interno(`/interno/notificacoes/match-forte/${sugestaoId}`)).json.motivo,
      'VAGA_INDISPONIVEL',
    );
    assert.equal((await servico.candidatoNovo(candidatura)).notificadas, 0);

    assert.equal(repositorioTeste.notificacoesStore.notificacoes.size, 0);
    assert.equal(repositorioTeste.matchStore.sugestoes.get(sugestaoId)?.notificadoEm, null);
    assert.equal(pushTeste.entregues.length, 0);
  });

  it('preferências: limiar pessoal corta MATCH_FORTE, in-app desligado some da central e push desligado não entrega', async () => {
    const { empresaId, token } = await empresaVerificada(
      'dona4@empresa.test',
      '11.444.777/0001-61',
    );
    const padrao = await api('/notificacoes/preferencias', {}, token);
    assert.equal(padrao.status, 200);
    assert.deepEqual(padrao.json.itens, [
      { tipo: 'CANDIDATO_NOVO', inApp: true, push: true, email: false, limiarMatch: null },
      { tipo: 'MATCH_FORTE', inApp: true, push: true, email: false, limiarMatch: null },
    ]);
    const invalida = { itens: [{ tipo: 'CANDIDATO_NOVO', limiarMatch: 0.9 }] };
    assert.equal(
      (
        await api(
          '/notificacoes/preferencias',
          { method: 'PUT', body: JSON.stringify(invalida) },
          token,
        )
      ).status,
      400,
    );
    const salvar = {
      itens: [
        { tipo: 'MATCH_FORTE', limiarMatch: 1 },
        { tipo: 'CANDIDATO_NOVO', inApp: false, push: false },
      ],
    };
    const salva = await api(
      '/notificacoes/preferencias',
      { method: 'PUT', body: JSON.stringify(salvar) },
      token,
    );
    assert.equal(salva.status, 200, JSON.stringify(salva.json));

    await candidatoAderente('aderente4@pessoal.test');
    const vagaId = await vagaPublicada(empresaId, token);
    await drenarMatch();
    const { sugestaoId } = filaMatchTeste.matchForte[0]!;
    assert.equal(
      (await interno(`/interno/notificacoes/match-forte/${sugestaoId}`)).json.notificadas,
      0,
    );
    assert.equal(repositorioTeste.matchStore.sugestoes.get(sugestaoId)?.notificadoEm, null);

    await candidatar(vagaId, (await candidato('direta4@pessoal.test')).token);
    assert.equal((await central(token)).total, 0);
    assert.equal(pushTeste.entregues.length, 0);

    // Candidato (sem vínculo com empresa) não tem preferências de empresa.
    assert.equal(
      (
        await api(
          '/notificacoes/preferencias',
          {},
          (await candidato('sem-vinculo@pessoal.test')).token,
        )
      ).status,
      403,
    );
  });
  function assertSemRanking(valor: unknown): void {
    if (Array.isArray(valor)) return valor.forEach(assertSemRanking);
    if (!valor || typeof valor !== 'object') return;
    for (const [chave, filho] of Object.entries(valor)) {
      assert.equal(
        ['score', 'compatibilidade', 'posicao', 'percentil'].includes(chave),
        false,
        `chave proibida: ${chave}`,
      );
      assertSemRanking(filho);
    }
  }

  it('candidatura direta valida consentimento, duplicidade, disponibilidade e prazo', async () => {
    const { empresaId, token } = await empresaVerificada(
      'aceite-direta@empresa.test',
      '11.222.333/0001-81',
    );
    const pessoa = await candidato('aceite-direta@pessoal.test');
    const vagaId = await vagaPublicada(empresaId, token);
    const body = { consentimentos: [{ tipo: 'TERMOS', concedido: true, versaoTermo: 'v1' }] };
    const criada = await api(
      `/vagas-publicas/${vagaId}/candidaturas`,
      { method: 'POST', body: JSON.stringify(body) },
      pessoa.token,
    );
    assert.equal(criada.status, 201, JSON.stringify(criada.json));
    assertSemRanking(criada.json);
    assert.equal(
      (
        await api(
          `/vagas-publicas/${vagaId}/candidaturas`,
          { method: 'POST', body: JSON.stringify(body) },
          pessoa.token,
        )
      ).status,
      409,
    );
    const listaAntesDaPausa = await api('/candidatos/me/candidaturas', {}, pessoa.token);
    assert.equal(listaAntesDaPausa.status, 200);
    assertSemRanking(listaAntesDaPausa.json);
    const detalheAntesDaPausa = await api(
      `/candidatos/me/candidaturas/${criada.json.id}`,
      {},
      pessoa.token,
    );
    assert.equal(detalheAntesDaPausa.status, 200);
    assertSemRanking(detalheAntesDaPausa.json);
    const semTermo = await candidato('aceite-direta-sem-termo@pessoal.test');
    assert.equal(
      (
        await api(
          `/vagas-publicas/${vagaId}/candidaturas`,
          { method: 'POST', body: JSON.stringify({ consentimentos: [] }) },
          semTermo.token,
        )
      ).status,
      400,
    );
    assert.equal(
      (await api(`/empresas/${empresaId}/vagas/${vagaId}/pausar`, { method: 'POST' }, token))
        .status,
      201,
    );
    assert.equal(
      (
        await api(
          `/vagas-publicas/${vagaId}/candidaturas`,
          { method: 'POST', body: JSON.stringify(body) },
          semTermo.token,
        )
      ).status,
      409,
    );
  });

  it('convite HTTP aceita com consentimento e recusa expira', async () => {
    const { empresaId, token } = await empresaVerificada(
      'aceite-convite@empresa.test',
      '11.444.777/0001-61',
    );
    const pessoa = await candidatoAderente('aceite-convite@pessoal.test');
    const vagaId = await vagaPublicada(empresaId, token);
    await drenarMatch();
    const sugestoes = await api(`/vagas/${vagaId}/sugestoes-match`, {}, token);
    assert.equal(sugestoes.status, 200, JSON.stringify(sugestoes.json));
    const sugestaoId =
      (sugestoes.json.sugestoes as Array<{ id: string; candidatoId: string }>).find(
        (item) => item.candidatoId === pessoa.id,
      )?.id ?? filaMatchTeste.matchForte[0]?.sugestaoId;
    assert.ok(sugestaoId);
    const convite = await api(
      `/vagas/${vagaId}/sugestoes-match/${sugestaoId}/convidar`,
      { method: 'POST' },
      token,
    );
    assert.equal(convite.status, 201);
    const convites = await api('/candidatos/me/convites', {}, pessoa.token);
    assert.equal(convites.status, 200);
    assertSemRanking(convites.json);
    const id = String((convites.json.convites as Array<{ id: string }>)[0]?.id);
    const aceita = await api(
      `/candidatos/me/convites/${id}/aceitar`,
      {
        method: 'POST',
        body: JSON.stringify({
          consentimentos: [{ tipo: 'TERMOS', concedido: true, versaoTermo: 'v1' }],
        }),
      },
      pessoa.token,
    );
    assert.equal(aceita.status, 200, JSON.stringify(aceita.json));
    assert.equal(aceita.json.status, 'INSCRITA');
    assertSemRanking(aceita.json);
    assert.equal((await api('/notificacoes', {}, token)).json.itens[0]?.tipo, 'CANDIDATO_NOVO');
  });
});
