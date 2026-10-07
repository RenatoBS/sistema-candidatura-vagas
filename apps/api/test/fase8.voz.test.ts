import 'reflect-metadata';

import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { after, before, beforeEach, describe, it } from 'node:test';

import type { INestApplication } from '@nestjs/common';

process.env.NODE_ENV = 'test';
process.env.AUTH_STORE = 'memory';
process.env.JWT_SECRET = 'segredo-de-teste-com-32-bytes!!';
process.env.APP_ENCRYPTION_KEY = randomBytes(32).toString('base64');
process.env.INTERNAL_JOB_TOKEN = 'job-teste';
process.env.UAZAPI_WEBHOOK_SECRET = 'segredo-webhook';
process.env.API_PUBLIC_URL = 'http://localhost:3000';
process.env.LLM_PROVIDER = 'mock';
process.env.LOG_LEVEL = 'silent';

import { emailTeste, fonteCnpjTeste, limparAmbienteTeste, relogioTeste, repositorioTeste } from '../src/ambiente-teste';
import { extrairCodigo } from '../src/auth/segredos';

const SISTEMA = { sistema: true as const };
const AGORA = new Date('2026-10-07T15:00:00.000Z');
const RESPOSTA_LONGA = 'Tenho cinco anos de experiência prática nesta função e resultados objetivos.';
const PROIBIDOS = ['score', 'posicao', 'ranking', 'percentil', 'totalCandidatos'];

let app: INestApplication;
let base = '';

async function api(caminho: string, init: RequestInit = {}, token?: string) {
  const headers = new Headers(init.headers);
  if (token) headers.set('authorization', `Bearer ${token}`);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const resposta = await fetch(`${base}${caminho}`, { ...init, headers });
  const texto = await resposta.text();
  return { status: resposta.status, json: texto ? (JSON.parse(texto) as Record<string, unknown>) : {} };
}

function interno(caminho: string, body?: unknown) {
  return api(caminho, {
    method: 'POST',
    headers: { 'x-internal-token': 'job-teste' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function chaves(valor: unknown, acc = new Set<string>()): Set<string> {
  if (Array.isArray(valor)) valor.forEach((item) => chaves(item, acc));
  else if (valor && typeof valor === 'object') {
    for (const [chave, item] of Object.entries(valor)) {
      acc.add(chave);
      chaves(item, acc);
    }
  }
  return acc;
}

async function registrar(email: string) {
  const senha = 'senha1234';
  const cadastro = await api('/auth/cadastro', { method: 'POST', body: JSON.stringify({ email, senha }) });
  assert.equal(cadastro.status, 201);
  const codigo = extrairCodigo(emailTeste.ultimoPara(email)?.texto ?? '');
  assert.ok(codigo);
  assert.equal(
    (await api('/auth/confirmar-email', { method: 'POST', body: JSON.stringify({ token: codigo }) })).status,
    201,
  );
  const login = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, senha }) });
  assert.equal(login.status, 201);
  return String(login.json.accessToken);
}

async function empresaVerificada(email: string, cnpj: string) {
  const access = await registrar(email);
  const criada = await api(
    '/empresas/cadastro',
    {
      method: 'POST',
      body: JSON.stringify({
        razaoSocial: 'Acme Ltda',
        nomeFantasia: 'Acme',
        cnpj,
        dominio: `${cnpj.replace(/\D/g, '')}.example`,
        responsavelNome: 'Ana',
        responsavelEmail: `resp-${cnpj.replace(/\D/g, '').slice(0, 6)}@example.com`,
      }),
    },
    access,
  );
  assert.equal(criada.status, 201, JSON.stringify(criada.json));
  const empresaId = String((criada.json.empresa as { id: string }).id);
  const token = String((criada.json.sessao as { accessToken: string }).accessToken);
  const destino = `resp-${cnpj.replace(/\D/g, '').slice(0, 6)}@example.com`;
  const codigo = extrairCodigo(emailTeste.ultimoPara(destino)?.texto ?? '');
  assert.ok(codigo);
  assert.equal(
    (await api(`/empresas/${empresaId}/verificacao/email`, { method: 'POST', body: JSON.stringify({ codigo }) }, token))
      .status,
    201,
  );
  fonteCnpjTeste.definir(cnpj.replace(/\D/g, ''), {
    situacaoAtiva: true,
    razaoSocial: 'Acme Ltda',
    indisponivel: false,
  });
  assert.equal(
    (
      await api(`/interno/empresas/${empresaId}/verificar-cnpj`, {
        method: 'POST',
        headers: { 'x-internal-token': 'job-teste' },
      })
    ).status,
    201,
  );
  return { empresaId, token };
}

interface Cenario {
  empresaId: string;
  vagaId: string;
  candidaturaId: string;
}

async function cenario(opcoes?: {
  empresaId?: string;
  perguntas?: number;
  tempo?: number;
  consentimento?: boolean;
  vagaStatus?: 'PUBLICADA' | 'PAUSADA' | 'FECHADA';
}): Promise<Cenario> {
  const empresaId = opcoes?.empresaId ?? randomUUID();
  const usuarioCandidatoId = randomUUID();
  const candidatoId = randomUUID();
  const vagaId = randomUUID();
  const processoId = randomUUID();
  const etapaId = randomUUID();
  const candidaturaId = randomUUID();
  const agora = relogioTeste.agora();
  if (!opcoes?.empresaId) {
    const usuarioEmpresaId = randomUUID();
    await repositorioTeste.criarUsuario({
      id: usuarioEmpresaId,
      email: `${usuarioEmpresaId}@empresa.test`,
      senhaHash: 'x',
      papeisGlobais: [],
      mfaAtivo: false,
      mfaSecretCifrado: null,
      visaoPreferida: 'EMPRESA',
      emailConfirmadoEm: agora,
    });
    await repositorioTeste.criarEmpresaComResponsavel(
      {
        id: empresaId,
        razaoSocial: 'Oficina Alfa',
        nomeFantasia: 'Alfa',
        cnpj: empresaId.replace(/\D/g, '').padEnd(14, '1').slice(0, 14),
        dominio: 'alfa.test',
        responsavelNome: 'Lia',
        responsavelEmail: 'lia@alfa.test',
        responsavelCargo: null,
        telefone: null,
        endereco: null,
        statusVerificacao: 'VERIFICADA',
        verificadaEm: agora,
        configuracoes: {},
      },
      {
        id: randomUUID(),
        usuarioId: usuarioEmpresaId,
        empresaId,
        papeis: ['ADMIN_EMPRESA'],
        status: 'ATIVO',
      },
    );
  }
  await repositorioTeste.criarUsuario({
    id: usuarioCandidatoId,
    email: `${usuarioCandidatoId}@candidato.test`,
    senhaHash: 'x',
    papeisGlobais: [],
    mfaAtivo: false,
    mfaSecretCifrado: null,
    visaoPreferida: 'CANDIDATO',
    emailConfirmadoEm: agora,
  });
  await repositorioTeste.criarCandidato({ id: candidatoId, usuarioId: usuarioCandidatoId, nome: 'Candidato Alfa' });
  if (opcoes?.consentimento !== false) {
    await repositorioTeste.registrarConsentimento({
      id: randomUUID(),
      candidatoId,
      tipo: 'GRAVACAO_VOZ',
      concedido: true,
      versaoTermo: 'v1',
      criadoEm: agora,
    });
  }
  await repositorioTeste.criarVaga(
    {
      id: vagaId,
      empresaId,
      titulo: 'Pessoa analista',
      descricao: 'Descrição fictícia da vaga.',
      senioridade: 'PLENO',
      modelo: 'REMOTO',
      localidade: null,
      tipoContrato: null,
      faixaSalarialMin: null,
      faixaSalarialMax: null,
      beneficios: [],
      posicoes: 1,
      status: opcoes?.vagaStatus ?? 'PUBLICADA',
      prazoInscricoes: new Date('2026-12-01T00:00:00.000Z'),
      inscricoesEncerradasEm: null,
      pausadaEm: null,
      statusAntesDaPausa: null,
      fechadaEm: null,
      motivoFechamento: null,
      alertaPausaEm: null,
      criadoEm: agora,
      atualizadoEm: agora,
    },
    SISTEMA,
  );
  await repositorioTeste.salvarProcesso(
    {
      id: processoId,
      vagaId,
      empresaId,
      tempoPadraoPorPergunta: opcoes?.tempo ?? 30,
      politicaRetry: {
        tentativas: 3,
        intervaloMinutos: 240,
        prazoTotalHoras: 72,
        horarioComercial: true,
        prazoInatividadeHoras: 24,
      },
      janelaReconexaoSegundos: 60,
    },
    SISTEMA,
  );
  const total = opcoes?.perguntas ?? 2;
  await repositorioTeste.salvarEtapa(
    { id: etapaId, processoId, ordem: 2, tipo: 'ENTREVISTA_VOZ', numeroPerguntas: total },
    SISTEMA,
  );
  for (let ordem = 1; ordem <= total; ordem += 1) {
    const perguntaId = randomUUID();
    await repositorioTeste.criarPergunta(
      {
        id: perguntaId,
        empresaId,
        enunciado: `Pergunta ${ordem}`,
        rubrica: { clareza: 1 },
        origem: 'EMPRESA',
        statusSugestao: 'NAO_APLICA',
        versaoPrompt: null,
        etapaAlvoId: etapaId,
        tempoLimiteSegundos: opcoes?.tempo ?? 30,
      },
      SISTEMA,
    );
    await repositorioTeste.vincularPergunta(
      { id: randomUUID(), etapaId, perguntaId, ordem, peso: 1, tempoLimiteSegundos: opcoes?.tempo ?? 30 },
      SISTEMA,
    );
  }
  await repositorioTeste.criarCandidatura(
    {
      id: candidaturaId,
      empresaId,
      vagaId,
      candidatoId,
      origem: 'DIRETA',
      status: 'TRIAGEM_CONCLUIDA',
      statusAntesDaEspera: null,
      etapaAtualId: etapaId,
      criadoEm: agora,
      atualizadoEm: agora,
    },
    {
      id: randomUUID(),
      candidaturaId,
      de: 'TRIAGEM_CONCLUIDA',
      para: 'TRIAGEM_CONCLUIDA',
      autorId: null,
      motivo: null,
      criadoEm: agora,
    },
    SISTEMA,
  );
  return { empresaId, vagaId, candidaturaId };
}

async function abrir(candidaturaId: string) {
  const preparado = await interno(`/interno/voz/candidaturas/${candidaturaId}/preparar`);
  assert.equal(preparado.status, 200, JSON.stringify(preparado.json));
  const entrevistaId = String(preparado.json.id);
  const aceite = await interno(`/interno/voz/entrevistas/${entrevistaId}/aceitar`);
  assert.equal(aceite.status, 200, JSON.stringify(aceite.json));
  assert.match(String(aceite.json.token), /^lk_fake_/);
  return { entrevistaId, sessaoId: String(aceite.json.sessaoId), aceite: aceite.json };
}

describe('F8 entrevista por voz', () => {
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

  after(async () => app.close());

  beforeEach(() => {
    limparAmbienteTeste();
    relogioTeste.definir(AGORA);
    delete process.env.VOZ_MAX_SESSOES;
  });

  it('faz as perguntas em ordem, grava transcrição e não elimina', async () => {
    const baseCenario = await cenario();
    const sessao = await abrir(baseCenario.candidaturaId);
    assert.equal(sessao.aceite.enunciado, 'Pergunta 1');
    const primeira = await interno(`/interno/voz/sessoes/${sessao.sessaoId}/turno`, { texto: RESPOSTA_LONGA });
    assert.equal(primeira.status, 200, JSON.stringify(primeira.json));
    assert.equal(primeira.json.enunciado, 'Pergunta 2');
    assert.ok(Array.isArray(primeira.json.etapas));
    const segunda = await interno(`/interno/voz/sessoes/${sessao.sessaoId}/turno`, { texto: RESPOSTA_LONGA });
    assert.equal(segunda.json.acao, 'concluida');
    assert.equal(segunda.json.eliminada, false);
    const candidatura = await repositorioTeste.buscarCandidatura(baseCenario.candidaturaId, SISTEMA);
    assert.equal(candidatura?.status, 'ENTREVISTA_CONCLUIDA');
    const respostas = await repositorioTeste.listarRespostasEntrevista(sessao.entrevistaId, SISTEMA);
    assert.equal(respostas.length, 2);
    assert.ok(respostas.every((item) => item.transcricao && item.tipo === 'VOZ_TEMPO_REAL'));
    const visao = await api(`/interno/voz/entrevistas/${sessao.entrevistaId}/visao`, {
      headers: { 'x-internal-token': 'job-teste' },
    });
    for (const chave of PROIBIDOS) assert.equal(chaves(visao.json).has(chave), false, chave);
  });

  it('no estouro grava expirou e avança sem reprovar', async () => {
    const baseCenario = await cenario({ perguntas: 2, tempo: 30 });
    const sessao = await abrir(baseCenario.candidaturaId);
    relogioTeste.definir(new Date(AGORA.getTime() + 31_000));
    const estouro = await interno(`/interno/voz/sessoes/${sessao.sessaoId}/expirar`);
    assert.equal(estouro.status, 200, JSON.stringify(estouro.json));
    assert.equal(estouro.json.expirou, true);
    assert.equal(estouro.json.enunciado, 'Pergunta 2');
    const respostas = await repositorioTeste.listarRespostasEntrevista(sessao.entrevistaId, SISTEMA);
    assert.equal(respostas[0]?.expirou, true);
    const candidatura = await repositorioTeste.buscarCandidatura(baseCenario.candidaturaId, SISTEMA);
    assert.equal(candidatura?.status, 'ENTREVISTA_VOZ');
    assert.notEqual(candidatura?.status, 'REPROVADA');
  });

  it('fechar o app consome a tentativa e a segunda é rejeitada', async () => {
    const baseCenario = await cenario();
    const sessao = await abrir(baseCenario.candidaturaId);
    const fim = await interno(`/interno/voz/sessoes/${sessao.sessaoId}/encerrar`);
    assert.equal(fim.json.status, 'ABANDONADA');
    const deNovo = await interno(`/interno/voz/entrevistas/${sessao.entrevistaId}/aceitar`);
    assert.equal(deNovo.status, 409);
    assert.equal(deNovo.json.codigo, 'TENTATIVA_CONSUMIDA');
    const candidatura = await repositorioTeste.buscarCandidatura(baseCenario.candidaturaId, SISTEMA);
    assert.equal(candidatura?.status, 'ENTREVISTA_ABANDONADA');
  });

  it('queda curta reconecta a mesma sessão com o cronômetro pausado', async () => {
    const baseCenario = await cenario({ tempo: 30 });
    const sessao = await abrir(baseCenario.candidaturaId);
    relogioTeste.definir(new Date(AGORA.getTime() + 10_000));
    assert.equal((await interno(`/interno/voz/sessoes/${sessao.sessaoId}/desconectar`)).status, 200);
    relogioTeste.definir(new Date(AGORA.getTime() + 30_000));
    const volta = await interno(`/interno/voz/sessoes/${sessao.sessaoId}/reconectar`);
    assert.equal(volta.json.mesmaSessao, true, JSON.stringify(volta.json));
    assert.equal(volta.json.sessaoId, sessao.sessaoId);
    assert.equal(volta.json.segundosRestantes, 20);
  });

  it('queda além da janela abandona', async () => {
    const baseCenario = await cenario();
    const sessao = await abrir(baseCenario.candidaturaId);
    assert.equal((await interno(`/interno/voz/sessoes/${sessao.sessaoId}/desconectar`)).status, 200);
    relogioTeste.definir(new Date(AGORA.getTime() + 61_000));
    const volta = await interno(`/interno/voz/sessoes/${sessao.sessaoId}/reconectar`);
    assert.equal(volta.json.status, 'ABANDONADA');
    assert.equal(volta.json.mesmaSessao, false);
  });

  it('concede uma exceção auditada e recusa a segunda', async () => {
    const dona = await empresaVerificada('dona-voz@example.com', '11.222.333/0001-81');
    const baseCenario = await cenario({ empresaId: dona.empresaId });
    const sessao = await abrir(baseCenario.candidaturaId);
    await interno(`/interno/voz/sessoes/${sessao.sessaoId}/encerrar`);
    const primeira = await api(
      `/empresas/${dona.empresaId}/voz/${sessao.entrevistaId}/excecao`,
      { method: 'POST', body: JSON.stringify({ motivo: 'falha de rede documentada' }) },
      dona.token,
    );
    assert.equal(primeira.status, 200, JSON.stringify(primeira.json));
    const deNovo = await interno(`/interno/voz/entrevistas/${sessao.entrevistaId}/aceitar`);
    assert.equal(deNovo.status, 200, JSON.stringify(deNovo.json));
    await interno(`/interno/voz/sessoes/${String(deNovo.json.sessaoId)}/encerrar`);
    const segunda = await api(
      `/empresas/${dona.empresaId}/voz/${sessao.entrevistaId}/excecao`,
      { method: 'POST', body: JSON.stringify({ motivo: 'outra chance' }) },
      dona.token,
    );
    assert.equal(segunda.status, 409);
    assert.equal(segunda.json.codigo, 'EXCECAO_JA_CONCEDIDA');
    const auditoria = await repositorioTeste.listarAuditoria({ empresaId: dona.empresaId }, dona.empresaId);
    assert.ok(auditoria.some((item) => item.acao === 'CONCEDER_EXCECAO_VOZ'));
  });

  it('vaga pausada e falta de consentimento impedem o início', async () => {
    const pausada = await cenario({ vagaStatus: 'PAUSADA' });
    const bloqueio = await interno(`/interno/voz/candidaturas/${pausada.candidaturaId}/preparar`);
    assert.equal(bloqueio.status, 409);
    assert.equal(bloqueio.json.codigo, 'VAGA_INDISPONIVEL');
    const semConsentimento = await cenario({ consentimento: false });
    const negado = await interno(`/interno/voz/candidaturas/${semConsentimento.candidaturaId}/preparar`);
    assert.equal(negado.status, 403);
    assert.equal(negado.json.codigo, 'SEM_CONSENTIMENTO');
  });

  it('gravação e transcrição exigem auditoria e isolam a empresa', async () => {
    const dona = await empresaVerificada('dona-gravacao@example.com', '11.222.333/0001-81');
    const outra = await empresaVerificada('outra-gravacao@example.com', '22.333.444/0001-81');
    const baseCenario = await cenario({ empresaId: dona.empresaId, perguntas: 1 });
    const sessao = await abrir(baseCenario.candidaturaId);
    await interno(`/interno/voz/sessoes/${sessao.sessaoId}/turno`, { texto: RESPOSTA_LONGA });
    const alheia = await api(`/empresas/${outra.empresaId}/voz/${sessao.entrevistaId}`, {}, outra.token);
    assert.equal(alheia.status, 404);
    const detalhe = await api(`/empresas/${dona.empresaId}/voz/${sessao.entrevistaId}`, {}, dona.token);
    assert.equal(detalhe.status, 200, JSON.stringify(detalhe.json));
    const respostas = detalhe.json.respostas as { transcricao: string; nota: number }[];
    assert.equal(respostas[0]?.transcricao, RESPOSTA_LONGA);
    assert.equal(respostas[0]?.nota, 8);
    for (const chave of PROIBIDOS) assert.equal(chaves(detalhe.json).has(chave), false);
    const gravacao = await api(
      `/empresas/${dona.empresaId}/voz/${sessao.entrevistaId}/gravacao?motivo=revisao%20da%20entrevista`,
      {},
      dona.token,
    );
    assert.equal(gravacao.status, 200, JSON.stringify(gravacao.json));
    assert.match(String(gravacao.json.url), /expira=60/);
    const auditoria = await repositorioTeste.listarAuditoria({ empresaId: dona.empresaId }, dona.empresaId);
    assert.ok(auditoria.some((item) => item.acao === 'LER_AUDIO' && item.recursoTipo === 'GRAVACAO'));
  });

  it('fila de admissão e várias sessões paralelas preservam o estado', async () => {
    process.env.VOZ_MAX_SESSOES = '1';
    const primeira = await cenario();
    const segunda = await cenario();
    await abrir(primeira.candidaturaId);
    const preparado = await interno(`/interno/voz/candidaturas/${segunda.candidaturaId}/preparar`);
    const fila = await interno(`/interno/voz/entrevistas/${String(preparado.json.id)}/aceitar`);
    assert.equal(fila.status, 429);
    assert.equal(fila.json.codigo, 'FILA_ADMISSAO');
    delete process.env.VOZ_MAX_SESSOES;
    const lote = await Promise.all(
      Array.from({ length: 8 }, async () => {
        const item = await cenario({ perguntas: 1 });
        const sessao = await abrir(item.candidaturaId);
        const fim = await interno(`/interno/voz/sessoes/${sessao.sessaoId}/turno`, { texto: RESPOSTA_LONGA });
        return { candidaturaId: item.candidaturaId, fim: fim.json.acao };
      }),
    );
    assert.ok(lote.every((item) => item.fim === 'concluida'));
    for (const item of lote) {
      const candidatura = await repositorioTeste.buscarCandidatura(item.candidaturaId, SISTEMA);
      assert.equal(candidatura?.status, 'ENTREVISTA_CONCLUIDA');
    }
  });
});
