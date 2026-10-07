import 'reflect-metadata';

import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { after, before, beforeEach, describe, it } from 'node:test';

import { contemRanking, type StatusVaga } from '@scv/domain';

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
  embeddingsTeste,
  filaCnpjTeste,
  filaMatchTeste,
  fonteCnpjTeste,
  limparAmbienteTeste,
  relogioTeste,
  repositorioTeste,
} from '../src/ambiente-teste';
import { extrairCodigo } from '../src/auth/segredos';
import { lerConfiguracao } from '../src/configuracao';

const AGORA = new Date('2026-10-06T15:00:00.000Z');
const PRAZO = '2026-11-20T23:59';

let base = '';
let fechar: () => Promise<void> = async () => {};

type Json = Record<string, unknown>;

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

/** Executa os jobs enfileirados (embeddings → match) como o worker faria. */
async function drenar(): Promise<void> {
  for (let rodada = 0; rodada < 10; rodada += 1) {
    const tarefas = [
      ...filaMatchTeste.embeddingsVaga.splice(0).map((id) => `/interno/match/embeddings/vagas/${id}`),
      ...filaMatchTeste.embeddingsCandidato.splice(0).map((id) => `/interno/match/embeddings/candidatos/${id}`),
      ...filaMatchTeste.matchVaga.splice(0).map((id) => `/interno/match/vagas/${id}`),
      ...filaMatchTeste.matchCandidato.splice(0).map((id) => `/interno/match/candidatos/${id}`),
    ];
    if (tarefas.length === 0) return;
    for (const tarefa of tarefas) {
      const resposta = await interno(tarefa);
      assert.equal(resposta.status, 200, `${tarefa}: ${JSON.stringify(resposta.json)}`);
    }
  }
  throw new Error('fila de match não esvaziou');
}

async function contaConfirmada(email: string) {
  const senha = 'senha1234';
  assert.equal((await api('/auth/cadastro', { method: 'POST', body: JSON.stringify({ email, senha }) })).status, 201);
  const codigo = extrairCodigo(emailTeste.ultimoPara(email)?.texto ?? '');
  assert.ok(codigo);
  await api('/auth/confirmar-email', { method: 'POST', body: JSON.stringify({ token: codigo }) });
  const login = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, senha }) });
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
  await api(`/empresas/${empresaId}/verificacao/email`, { method: 'POST', body: JSON.stringify({ codigo }) }, token);
  fonteCnpjTeste.definir(cnpj.replace(/\D/g, ''), { situacaoAtiva: true, razaoSocial: 'Acme Ltda', indisponivel: false });
  assert.equal(filaCnpjTeste.jobs.includes(empresaId), true);
  assert.equal((await interno(`/interno/empresas/${empresaId}/verificar-cnpj`)).status, 201);
  return { empresaId, token };
}

async function candidato(email: string) {
  const access = await contaConfirmada(email);
  const onboard = await api('/onboarding/candidato', { method: 'POST', body: JSON.stringify({ nome: 'Pessoa Teste' }) }, access);
  assert.equal(onboard.status, 201);
  const token = String(onboard.json.accessToken);
  const perfil = await api('/candidatos/me', {}, token);
  return { token, id: String(perfil.json.id) };
}

async function habilidadeId(nome: string): Promise<string> {
  const catalogo = (await api('/habilidades')).json as unknown as Array<{ id: string; nome: string }>;
  const item = catalogo.find((habilidade) => habilidade.nome === nome);
  assert.ok(item, nome);
  return item.id;
}

async function perfilCompleto(token: string, resumo: string, habilidades: Array<{ nome: string; nivel: number }>, visivel: boolean) {
  const itens = [];
  for (const item of habilidades) itens.push({ habilidadeId: await habilidadeId(item.nome), nivel: item.nivel });
  assert.equal((await api('/candidatos/me/habilidades', { method: 'PUT', body: JSON.stringify({ itens }) }, token)).status, 200);
  const salvo = await api('/candidatos/me', { method: 'PUT', body: JSON.stringify({ perfil: { resumo }, visivelParaMatch: visivel }) }, token);
  assert.equal(salvo.status, 200, JSON.stringify(salvo.json));
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
    { method: 'PUT', body: JSON.stringify({ etapas: [{ ordem: 1, tipo: 'ENTREVISTA_VOZ', numeroPerguntas: 1 }] }) },
    token,
  );
  const etapaId = String(((processo.json.processo as { etapas: Array<{ id: string }> }).etapas[0] ?? {}).id);
  const pergunta = await api(
    `/empresas/${empresaId}/vagas/${vagaId}/etapas/${etapaId}/perguntas`,
    { method: 'POST', body: JSON.stringify({ enunciado: 'Conte um projeto recente.' }) },
    token,
  );
  assert.equal(pergunta.status, 201);
  const publicada = await api(`/empresas/${empresaId}/vagas/${vagaId}/publicar`, { method: 'POST' }, token);
  assert.equal(publicada.status, 201, JSON.stringify(publicada.json));
  return vagaId;
}

interface SugestaoDto {
  candidatoId: string;
  compatibilidade: number;
  forte: boolean;
  status: string;
  explicacao: { atendidas: string[]; similaridade: number; coberturaHabilidades: number };
  candidato: Json;
}

async function sugestoes(vagaId: string, token: string): Promise<SugestaoDto[]> {
  const resposta = await api(`/vagas/${vagaId}/sugestoes-match`, {}, token);
  assert.equal(resposta.status, 200, JSON.stringify(resposta.json));
  assert.equal(resposta.json.limiarForte, 0.75);
  return resposta.json.sugestoes as SugestaoDto[];
}

const RESUMO_ADERENTE = 'Desenvolvedor backend TypeScript. APIs em Node.js com TypeScript e PostgreSQL.';
const HABILIDADES_ADERENTES = [
  { nome: 'TypeScript', nivel: 5 },
  { nome: 'PostgreSQL', nivel: 4 },
];

describe('Fase 6 — embeddings e match (F6-04)', () => {
  before(async () => {
    const { NestFactory } = await import('@nestjs/core');
    const { AppModule } = await import('../src/app.module');
    const { FiltroErros } = await import('../src/http/filtro-erros');
    const app = await NestFactory.create(AppModule, { logger: false });
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new FiltroErros());
    await app.listen(0);
    base = `${await app.getUrl()}/api/v1`;
    fechar = () => app.close();
  });

  after(async () => {
    await fechar();
  });

  beforeEach(() => {
    limparAmbienteTeste();
    relogioTeste.definir(AGORA);
  });

  it('publicar gera embedding e o match cria sugestão com compatibilidade e explicação; opt-in e obrigatórias filtram', async () => {
    const { empresaId, token } = await empresaVerificada('dona@empresa.test', '11.222.333/0001-81');

    const aderente = await candidato('aderente@pessoal.test');
    await perfilCompleto(aderente.token, RESUMO_ADERENTE, HABILIDADES_ADERENTES, true);
    const semOptIn = await candidato('oculto@pessoal.test');
    await perfilCompleto(semOptIn.token, RESUMO_ADERENTE, HABILIDADES_ADERENTES, false);
    const saiuDoMatch = await candidato('saiu@pessoal.test');
    await perfilCompleto(saiuDoMatch.token, RESUMO_ADERENTE, HABILIDADES_ADERENTES, true);
    const semObrigatoria = await candidato('sem-ts@pessoal.test');
    await perfilCompleto(semObrigatoria.token, RESUMO_ADERENTE, [{ nome: 'TypeScript', nivel: 2 }, { nome: 'PostgreSQL', nivel: 5 }], true);

    // Opt-in é o padrão desligado (Q17): sem PUT, o perfil nasce invisível e não vai ao provedor de embeddings.
    const novo = await candidato('padrao@pessoal.test');
    assert.equal((await api('/candidatos/me', {}, novo.token)).json.visivelParaMatch, false);
    assert.equal(filaMatchTeste.embeddingsCandidato.includes(semOptIn.id), false);
    await drenar();
    const textosEnviados = embeddingsTeste.chamadas.flat().join('\n');
    assert.doesNotMatch(textosEnviados, /Pessoa Teste/);

    // Quem tinha embedding e saiu do match não entra mais.
    assert.equal((await api('/candidatos/me', { method: 'PUT', body: JSON.stringify({ visivelParaMatch: false }) }, saiuDoMatch.token)).status, 200);

    const vagaId = await vagaPublicada(empresaId, token);
    assert.deepEqual(filaMatchTeste.embeddingsVaga, [vagaId]);
    await drenar();

    const lista = await sugestoes(vagaId, token);
    assert.deepEqual(lista.map((item) => item.candidatoId), [aderente.id]);
    const [sugestao] = lista;
    assert.ok(sugestao!.compatibilidade >= 0.75 && sugestao!.compatibilidade <= 1, String(sugestao!.compatibilidade));
    assert.equal(sugestao!.forte, true);
    assert.equal(sugestao!.status, 'NOTIFICADA');
    assert.deepEqual(sugestao!.explicacao.atendidas, ['TypeScript', 'PostgreSQL']);
    assert.equal(sugestao!.explicacao.coberturaHabilidades, 1);
    assert.deepEqual(Object.keys(sugestao!.candidato).sort(), ['habilidades', 'primeiroNome']);

    // match.forte sai uma única vez por vaga+candidato, mesmo reprocessando os dois sentidos.
    assert.equal(filaMatchTeste.matchForte.length, 1);
    assert.deepEqual(
      { vagaId: filaMatchTeste.matchForte[0]?.vagaId, candidatoId: filaMatchTeste.matchForte[0]?.candidatoId, empresaId: filaMatchTeste.matchForte[0]?.empresaId },
      { vagaId, candidatoId: aderente.id, empresaId },
    );
    assert.equal((await interno(`/interno/match/vagas/${vagaId}`)).status, 200);
    assert.equal((await interno(`/interno/match/candidatos/${aderente.id}`)).status, 200);
    assert.equal(filaMatchTeste.matchForte.length, 1);
    assert.equal((await sugestoes(vagaId, token)).length, 1);

    // Candidato vê a vaga recomendada, sem score/compatibilidade.
    const recomendadas = await api('/candidatos/me/vagas-recomendadas', {}, aderente.token);
    assert.equal(recomendadas.status, 200);
    const vagas = recomendadas.json.vagas as Array<{ id: string; habilidadesEmComum: string[] }>;
    assert.deepEqual(vagas.map((item) => item.id), [vagaId]);
    assert.deepEqual(vagas[0]?.habilidadesEmComum, ['TypeScript', 'PostgreSQL']);
    assert.equal(contemRanking(recomendadas.json), false);
    const oculto = await api('/candidatos/me/vagas-recomendadas', {}, semOptIn.token);
    assert.deepEqual(oculto.json, { visivelParaMatch: false, vagas: [] });
  });

  it('candidato que entra no match depois da publicação recebe a vaga pelo job candidato → vagas', async () => {
    const { empresaId, token } = await empresaVerificada('dona2@empresa.test', '11.444.777/0001-61');
    const vagaId = await vagaPublicada(empresaId, token);
    await drenar();
    assert.equal((await sugestoes(vagaId, token)).length, 0);

    const tardio = await candidato('tardio@pessoal.test');
    await perfilCompleto(tardio.token, RESUMO_ADERENTE, HABILIDADES_ADERENTES, true);
    assert.equal(filaMatchTeste.embeddingsCandidato.includes(tardio.id), true);
    await drenar();
    assert.deepEqual((await sugestoes(vagaId, token)).map((item) => item.candidatoId), [tardio.id]);
  });

  it('match não roda para vaga pausada, encerrada, fechada ou rascunho', async () => {
    const { empresaId, token } = await empresaVerificada('dona3@empresa.test', '11.222.333/0001-81');
    const vagaId = await vagaPublicada(empresaId, token);
    await drenar();
    assert.equal((await api(`/empresas/${empresaId}/vagas/${vagaId}/pausar`, { method: 'POST' }, token)).status, 201);

    const pessoa = await candidato('pausa@pessoal.test');
    await perfilCompleto(pessoa.token, RESUMO_ADERENTE, HABILIDADES_ADERENTES, true);
    await drenar();
    const direto = await interno(`/interno/match/vagas/${vagaId}`);
    assert.equal(direto.json.ignorada, true);
    assert.equal(direto.json.status, 'PAUSADA');
    assert.equal((await sugestoes(vagaId, token)).length, 0);
    assert.equal(filaMatchTeste.matchForte.length, 0);
    assert.deepEqual((await api('/candidatos/me/vagas-recomendadas', {}, pessoa.token)).json.vagas, []);

    // Ao retomar, a vaga volta a ser elegível e o match roda.
    assert.equal((await api(`/empresas/${empresaId}/vagas/${vagaId}/retomar`, { method: 'POST' }, token)).status, 201);
    assert.deepEqual(filaMatchTeste.embeddingsVaga, [vagaId]);
    await drenar();
    assert.deepEqual((await sugestoes(vagaId, token)).map((item) => item.candidatoId), [pessoa.id]);

    for (const status of ['RASCUNHO', 'INSCRICOES_ENCERRADAS', 'FECHADA'] as StatusVaga[]) {
      const vaga = await repositorioTeste.criarVaga(
        {
          id: randomUUID(),
          empresaId,
          titulo: 'Desenvolvedor backend TypeScript',
          descricao: 'APIs em Node.js com TypeScript e PostgreSQL.',
          senioridade: 'PLENO',
          modelo: 'REMOTO',
          localidade: null,
          tipoContrato: null,
          faixaSalarialMin: null,
          faixaSalarialMax: null,
          beneficios: [],
          posicoes: 1,
          status,
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
      const embedding = await interno(`/interno/match/embeddings/vagas/${vaga.id}`);
      assert.equal(embedding.json.matchEnfileirado, false, status);
      const match = await interno(`/interno/match/vagas/${vaga.id}`);
      assert.equal(match.json.ignorada, true, status);
      assert.equal((await sugestoes(vaga.id, token)).length, 0, status);
    }
    assert.equal((await interno(`/interno/match/candidatos/${pessoa.id}`)).json.sugestoes, 1);
  });

  it('MATCH_LIMIAR_FORTE tem padrão 0,75 e rejeita valores fora de (0, 1]', () => {
    assert.equal(lerConfiguracao({ NODE_ENV: 'test' }).matchLimiarForte, 0.75);
    assert.equal(lerConfiguracao({ NODE_ENV: 'test', MATCH_LIMIAR_FORTE: '0.8' }).matchLimiarForte, 0.8);
    for (const valor of ['0', '1.5', 'abc']) {
      assert.throws(() => lerConfiguracao({ NODE_ENV: 'test', MATCH_LIMIAR_FORTE: valor }), /MATCH_LIMIAR_FORTE/);
    }
  });

  it('sugestões só para a empresa dona da vaga; jobs internos exigem token', async () => {
    const dona = await empresaVerificada('dona4@empresa.test', '11.222.333/0001-81');
    const outra = await empresaVerificada('outra@empresa.test', '11.444.777/0001-61');
    const vagaId = await vagaPublicada(dona.empresaId, dona.token);
    const pessoa = await candidato('acesso@pessoal.test');
    await perfilCompleto(pessoa.token, RESUMO_ADERENTE, HABILIDADES_ADERENTES, true);
    await drenar();

    assert.equal((await api(`/vagas/${vagaId}/sugestoes-match`, {}, outra.token)).status, 404);
    assert.equal((await api(`/vagas/${vagaId}/sugestoes-match`, {}, pessoa.token)).status, 403);
    assert.equal((await api(`/interno/match/vagas/${vagaId}`, { method: 'POST' })).status, 401);
    assert.equal((await sugestoes(vagaId, dona.token)).length, 1);
  });
});
