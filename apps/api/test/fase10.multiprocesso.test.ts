import 'reflect-metadata';

import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { after, before, beforeEach, describe, it } from 'node:test';

import type { INestApplication } from '@nestjs/common';
import { percentil50 } from '@scv/domain';
import { cifrar } from '@scv/providers';

process.env.NODE_ENV = 'test';
process.env.AUTH_STORE = 'memory';
process.env.JWT_SECRET = 'segredo-de-teste-com-32-bytes!!';
process.env.APP_ENCRYPTION_KEY = randomBytes(32).toString('base64');
process.env.INTERNAL_JOB_TOKEN = 'job-teste';
process.env.UAZAPI_WEBHOOK_SECRET = 'segredo-webhook';
process.env.API_PUBLIC_URL = 'http://localhost:3000';
process.env.LLM_PROVIDER = 'mock';
process.env.LOG_LEVEL = 'silent';

import {
  cotaTeste,
  emailTeste,
  fonteCnpjTeste,
  limparAmbienteTeste,
  relogioTeste,
  repositorioTeste,
  whatsappMensagensTeste,
  whatsappTeste,
} from '../src/ambiente-teste';
import { extrairCodigo } from '../src/auth/segredos';
import { medirPipelineFake } from '../src/voz/pipeline-fake';
import { codigosTotp } from './totp';

const SISTEMA = { sistema: true as const };
const AGORA = new Date('2026-10-07T15:00:00.000Z');
const CHAVE = process.env.APP_ENCRYPTION_KEY!;

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
  return { token: String(login.json.accessToken), senha };
}

async function empresaVerificada(email: string, cnpj: string) {
  const { token: access } = await registrar(email);
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

async function criarVaga(empresaId: string, token: string, titulo: string) {
  const criada = await api(
    `/empresas/${empresaId}/vagas`,
    {
      method: 'POST',
      body: JSON.stringify({
        titulo,
        descricao: 'Descrição fictícia da vaga para o teste de isolamento.',
        senioridade: 'PLENO',
        modelo: 'REMOTO',
      }),
    },
    token,
  );
  assert.equal(criada.status, 201, JSON.stringify(criada.json));
  return String(criada.json.id);
}

async function tokenAdmin() {
  const { token: semMfa, senha } = await registrar('admin-fase10@plataforma.test');
  const usuario = await repositorioTeste.buscarUsuarioPorEmail('admin-fase10@plataforma.test');
  assert.ok(usuario);
  await repositorioTeste.atualizarUsuario(usuario.id, { papeisGlobais: ['ADMIN_PLATAFORMA'] });
  const relogin = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin-fase10@plataforma.test', senha }),
  });
  const access = String(relogin.json.accessToken);
  const inicio = await api('/auth/mfa/iniciar', { method: 'POST' }, access || semMfa);
  const segredo = new URL(String(inicio.json.otpauthUrl)).searchParams.get('secret');
  assert.ok(segredo);
  const codigo = codigosTotp(segredo);
  assert.equal(
    (await api('/auth/mfa/confirmar', { method: 'POST', body: JSON.stringify({ codigo: codigo() }) }, access)).status,
    201,
    JSON.stringify(inicio.json),
  );
  const verificado = await api(
    '/auth/mfa/verificar',
    { method: 'POST', body: JSON.stringify({ codigo: codigo() }) },
    access,
  );
  const visao = await api(
    '/me/visao',
    { method: 'PATCH', body: JSON.stringify({ visao: 'ADMIN' }) },
    String(verificado.json.accessToken),
  );
  assert.equal(visao.status, 200, JSON.stringify(visao.json));
  return String(visao.json.accessToken);
}

async function empresaMemoria(nome: string) {
  const empresaId = randomUUID();
  const usuarioId = randomUUID();
  const agora = relogioTeste.agora();
  await repositorioTeste.criarUsuario({
    id: usuarioId,
    email: `${usuarioId}@empresa.test`,
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
      razaoSocial: nome,
      nomeFantasia: nome,
      cnpj: empresaId.replace(/\D/g, '').padEnd(14, '1').slice(0, 14),
      dominio: `${nome}.test`,
      responsavelNome: 'Lia',
      responsavelEmail: 'lia@empresa.test',
      responsavelCargo: null,
      telefone: null,
      endereco: null,
      statusVerificacao: 'VERIFICADA',
      verificadaEm: agora,
      configuracoes: {},
    },
    {
      id: randomUUID(),
      usuarioId,
      empresaId,
      papeis: ['ADMIN_EMPRESA'],
      status: 'ATIVO',
    },
  );
  return empresaId;
}

async function vozDe(empresaId: string, candidatoId: string) {
  const vagaId = randomUUID();
  const processoId = randomUUID();
  const etapaId = randomUUID();
  const candidaturaId = randomUUID();
  const agora = relogioTeste.agora();
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
      status: 'PUBLICADA',
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
      tempoPadraoPorPergunta: 30,
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
  await repositorioTeste.salvarEtapa(
    { id: etapaId, processoId, ordem: 2, tipo: 'ENTREVISTA_VOZ', numeroPerguntas: 1 },
    SISTEMA,
  );
  const perguntaId = randomUUID();
  await repositorioTeste.criarPergunta(
    {
      id: perguntaId,
      empresaId,
      enunciado: 'Conte uma entrega recente.',
      rubrica: { clareza: 1 },
      origem: 'EMPRESA',
      statusSugestao: 'NAO_APLICA',
      versaoPrompt: null,
      etapaAlvoId: etapaId,
      tempoLimiteSegundos: 30,
    },
    SISTEMA,
  );
  await repositorioTeste.vincularPergunta(
    { id: randomUUID(), etapaId, perguntaId, ordem: 1, peso: 1, tempoLimiteSegundos: 30 },
    SISTEMA,
  );
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
  return { vagaId, candidaturaId };
}

async function candidato(nome: string) {
  const usuarioId = randomUUID();
  const candidatoId = randomUUID();
  const agora = relogioTeste.agora();
  await repositorioTeste.criarUsuario({
    id: usuarioId,
    email: `${usuarioId}@candidato.test`,
    senhaHash: 'x',
    papeisGlobais: [],
    mfaAtivo: false,
    mfaSecretCifrado: null,
    visaoPreferida: 'CANDIDATO',
    emailConfirmadoEm: agora,
  });
  await repositorioTeste.criarCandidato({ id: candidatoId, usuarioId, nome });
  await repositorioTeste.registrarConsentimento({
    id: randomUUID(),
    candidatoId,
    tipo: 'GRAVACAO_VOZ',
    concedido: true,
    versaoTermo: 'v1',
    criadoEm: agora,
  });
  return { usuarioId, candidatoId };
}

async function aceitarVoz(candidaturaId: string) {
  const preparado = await interno(`/interno/voz/candidaturas/${candidaturaId}/preparar`);
  assert.equal(preparado.status, 200, JSON.stringify(preparado.json));
  return interno(`/interno/voz/entrevistas/${String(preparado.json.id)}/aceitar`);
}

async function triagemDe(empresaId: string, candidatoId: string, titulo: string, numeroInstancia: string) {
  const vagaId = randomUUID();
  const processoId = randomUUID();
  const etapaId = randomUUID();
  const candidaturaId = randomUUID();
  const instanciaId = randomUUID();
  const tokenInstancia = `token-${instanciaId.slice(0, 8)}`;
  const agora = relogioTeste.agora();
  await repositorioTeste.criarVaga(
    {
      id: vagaId,
      empresaId,
      titulo,
      descricao: 'Descrição fictícia da vaga.',
      senioridade: 'PLENO',
      modelo: 'REMOTO',
      localidade: null,
      tipoContrato: null,
      faixaSalarialMin: null,
      faixaSalarialMax: null,
      beneficios: [],
      posicoes: 1,
      status: 'PUBLICADA',
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
      tempoPadraoPorPergunta: 180,
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
  await repositorioTeste.salvarEtapa(
    { id: etapaId, processoId, ordem: 1, tipo: 'TRIAGEM_WHATSAPP', numeroPerguntas: 1 },
    SISTEMA,
  );
  const perguntaId = randomUUID();
  await repositorioTeste.criarPergunta(
    {
      id: perguntaId,
      empresaId,
      enunciado: 'Pergunta 1',
      rubrica: { clareza: 1 },
      origem: 'EMPRESA',
      statusSugestao: 'NAO_APLICA',
      versaoPrompt: null,
      etapaAlvoId: etapaId,
      tempoLimiteSegundos: null,
    },
    SISTEMA,
  );
  await repositorioTeste.vincularPergunta(
    { id: randomUUID(), etapaId, perguntaId, ordem: 1, peso: 1, tempoLimiteSegundos: null },
    SISTEMA,
  );
  await repositorioTeste.criarCandidatura(
    {
      id: candidaturaId,
      empresaId,
      vagaId,
      candidatoId,
      origem: 'DIRETA',
      status: 'INSCRITA',
      statusAntesDaEspera: null,
      etapaAtualId: etapaId,
      criadoEm: agora,
      atualizadoEm: agora,
    },
    {
      id: randomUUID(),
      candidaturaId,
      de: 'INSCRITA',
      para: 'INSCRITA',
      autorId: null,
      motivo: null,
      criadoEm: agora,
    },
    SISTEMA,
  );
  await repositorioTeste.salvarInstancia(
    {
      id: instanciaId,
      empresaId,
      instanciaIdProvedorCifrado: cifrar(`prov-${instanciaId.slice(0, 8)}`, CHAVE),
      tokenCifrado: cifrar(tokenInstancia, CHAVE),
      numero: numeroInstancia,
      status: 'CONECTADA',
      ultimaConexaoEm: agora,
      desconectadaEm: null,
    },
    SISTEMA,
  );
  whatsappTeste.conectadas.add(tokenInstancia);
  return { vagaId, etapaId, candidaturaId, instanciaId, tokenInstancia };
}

describe('F10 multiprocesso', () => {
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
    delete process.env.COTA_API_POR_MINUTO;
    delete process.env.COTA_IA_POR_HORA;
    delete process.env.COTA_VOZ_POR_EMPRESA;
    delete process.env.VOZ_MAX_SESSOES;
    await app.close();
  });

  beforeEach(() => {
    limparAmbienteTeste();
    relogioTeste.definir(AGORA);
    delete process.env.COTA_API_POR_MINUTO;
    delete process.env.COTA_IA_POR_HORA;
    delete process.env.COTA_VOZ_POR_EMPRESA;
    delete process.env.VOZ_MAX_SESSOES;
  });

  it('bloqueia acesso cruzado e audita o bypass do admin', async () => {
    const alfa = await empresaVerificada('alfa-f10@example.com', '11.222.333/0001-81');
    const beta = await empresaVerificada('beta-f10@example.com', '22.333.444/0001-81');
    const vagaBeta = await criarVaga(beta.empresaId, beta.token, 'Vaga da Beta');
    const rotas = [
      `/empresas/${beta.empresaId}/vagas/${vagaBeta}`,
      `/empresas/${beta.empresaId}/vagas/${vagaBeta}/triagens`,
      `/empresas/${beta.empresaId}/vagas/${vagaBeta}/ranking`,
      `/empresas/${beta.empresaId}/vagas/${vagaBeta}/voz`,
    ];
    for (const rota of rotas) {
      const cruzado = await api(rota, {}, alfa.token);
      assert.ok(cruzado.status === 403 || cruzado.status === 404, `${rota} ${cruzado.status}`);
    }
    const propria = await api(`/empresas/${beta.empresaId}/vagas/${vagaBeta}`, {}, beta.token);
    assert.equal(propria.status, 200);
    const admin = await tokenAdmin();
    const bypass = await api(`/empresas/${beta.empresaId}/vagas/${vagaBeta}`, {}, admin);
    assert.equal(bypass.status, 200, JSON.stringify(bypass.json));
    const auditoria = await api('/admin/auditoria', {}, admin);
    assert.equal(auditoria.status, 200, JSON.stringify(auditoria.json));
    const eventos = auditoria.json as unknown as Array<{ acao: string }>;
    assert.ok(eventos.some((item) => item.acao === 'BYPASS_ADMIN'));
  });

  it('aplica cota de voz e de API sem afetar o outro tenant', async () => {
    process.env.COTA_VOZ_POR_EMPRESA = '1';
    const empresaA = await empresaMemoria('Alfa');
    const empresaB = await empresaMemoria('Beta');
    const pessoaA = await candidato('Pessoa A');
    const pessoaA2 = await candidato('Pessoa A2');
    const pessoaB = await candidato('Pessoa B');
    const primeira = await vozDe(empresaA, pessoaA.candidatoId);
    const segunda = await vozDe(empresaA, pessoaA2.candidatoId);
    const outra = await vozDe(empresaB, pessoaB.candidatoId);
    assert.equal((await aceitarVoz(primeira.candidaturaId)).status, 200);
    const estouro = await aceitarVoz(segunda.candidaturaId);
    assert.equal(estouro.status, 429);
    assert.equal(estouro.json.codigo, 'COTA_VOZ');
    assert.equal((await aceitarVoz(outra.candidaturaId)).status, 200);

    const dona = await empresaVerificada('cota-a@example.com', '11.222.333/0001-81');
    const vizinha = await empresaVerificada('cota-b@example.com', '33.444.555/0001-81');
    const vagaDona = await criarVaga(dona.empresaId, dona.token, 'Vaga cota');
    const vagaVizinha = await criarVaga(vizinha.empresaId, vizinha.token, 'Vaga vizinha');
    cotaTeste.limpar();
    process.env.COTA_API_POR_MINUTO = '2';
    assert.equal((await api(`/empresas/${dona.empresaId}/vagas/${vagaDona}`, {}, dona.token)).status, 200);
    assert.equal((await api(`/empresas/${dona.empresaId}/vagas/${vagaDona}`, {}, dona.token)).status, 200);
    const limitada = await api(`/empresas/${dona.empresaId}/vagas/${vagaDona}`, {}, dona.token);
    assert.equal(limitada.status, 429);
    assert.equal(limitada.json.codigo, 'COTA_API');
    assert.equal((await api(`/empresas/${vizinha.empresaId}/vagas/${vagaVizinha}`, {}, vizinha.token)).status, 200);
  });

  it('aplica cota de IA por empresa', async () => {
    process.env.COTA_IA_POR_HORA = '1';
    const empresaA = await empresaMemoria('IaA');
    const empresaB = await empresaMemoria('IaB');
    const agora = relogioTeste.agora();
    const criar = async (empresaId: string) => {
      const id = randomUUID();
      await repositorioTeste.criarResposta({
        id,
        empresaId,
        audioUrl: null,
        transcricao: 'Entrega fictícia com resultado objetivo e prazo cumprido.',
        textoOriginal: null,
        statusTranscricao: 'CONCLUIDA',
        confiancaTranscricao: 0.95,
        criadoEm: agora,
      });
      return id;
    };
    const a1 = await criar(empresaA);
    const a2 = await criar(empresaA);
    const b1 = await criar(empresaB);
    assert.equal((await interno(`/interno/triagem/respostas/${a1}/avaliar`)).status, 200);
    const estouro = await interno(`/interno/triagem/respostas/${a2}/avaliar`);
    assert.equal(estouro.status, 429);
    assert.equal(estouro.json.codigo, 'COTA_IA');
    assert.equal((await interno(`/interno/triagem/respostas/${b1}/avaliar`)).status, 200);
  });

  it('mantém uma sessão de voz por candidato e encerra sessão se a vaga fecha', async () => {
    const empresaA = await empresaMemoria('VozA');
    const empresaB = await empresaMemoria('VozB');
    const pessoa = await candidato('Pessoa unica');
    const outra = await candidato('Pessoa dois');
    const primeira = await vozDe(empresaA, pessoa.candidatoId);
    const paralela = await vozDe(empresaB, pessoa.candidatoId);
    const aceite = await aceitarVoz(primeira.candidaturaId);
    assert.equal(aceite.status, 200);
    const segunda = await aceitarVoz(paralela.candidaturaId);
    assert.equal(segunda.status, 409);
    assert.equal(segunda.json.codigo, 'SESSAO_VOZ_EM_ANDAMENTO');

    const extra = await vozDe(empresaA, outra.candidatoId);
    const turno = await interno(`/interno/voz/sessoes/${String(aceite.json.sessaoId)}/turno`, {
      texto: 'Tenho cinco anos de experiência prática nesta função e resultados objetivos.',
    });
    assert.equal(turno.status, 200, JSON.stringify(turno.json));
    assert.notEqual(turno.json.acao, 'encerrada');
    const preparado = await interno(`/interno/voz/candidaturas/${extra.candidaturaId}/preparar`);
    assert.equal(preparado.status, 200, JSON.stringify(preparado.json));
    await repositorioTeste.atualizarVaga(extra.vagaId, { status: 'PAUSADA' }, SISTEMA);
    const pausada = await interno(`/interno/voz/entrevistas/${String(preparado.json.id)}/aceitar`);
    assert.equal(pausada.status, 409);
    assert.equal(pausada.json.codigo, 'VAGA_INDISPONIVEL');

    const fechamento = await candidato('Pessoa fecha');
    const fechar = await vozDe(empresaB, fechamento.candidatoId);
    const aberta = await aceitarVoz(fechar.candidaturaId);
    assert.equal(aberta.status, 200, JSON.stringify(aberta.json));
    await repositorioTeste.atualizarVaga(fechar.vagaId, { status: 'FECHADA' }, SISTEMA);
    const encerrada = await interno(`/interno/voz/sessoes/${String(aberta.json.sessaoId)}/turno`, {
      texto: 'Resposta que não deve seguir com a vaga fechada e a sessão ativa.',
    });
    assert.equal(encerrada.status, 200, JSON.stringify(encerrada.json));
    assert.equal(encerrada.json.acao, 'encerrada');
    const sessao = await repositorioTeste.buscarSessaoVoz(String(aberta.json.sessaoId), SISTEMA);
    assert.equal(sessao?.status, 'FINALIZADA');
  });

  it('deduplica webhook simultâneo e identifica a vaga em três processos', async () => {
    const empresaId = await empresaMemoria('Hook');
    const instanciaId = randomUUID();
    const tokenInstancia = 'token-hook';
    const agora = relogioTeste.agora();
    await repositorioTeste.salvarInstancia(
      {
        id: instanciaId,
        empresaId,
        instanciaIdProvedorCifrado: cifrar('prov-hook', CHAVE),
        tokenCifrado: cifrar(tokenInstancia, CHAVE),
        numero: '5511900000099',
        status: 'CONECTADA',
        ultimaConexaoEm: agora,
        desconectadaEm: null,
      },
      SISTEMA,
    );
    const corpo = {
      token: tokenInstancia,
      message: {
        messageid: 'msg-dup',
        sender: '5511900000001@s.whatsapp.net',
        messageType: 'Conversation',
        text: 'oi',
      },
    };
    const [um, dois] = await Promise.all([
      api(`/webhooks/whatsapp/uazapi/${instanciaId}`, {
        method: 'POST',
        headers: { 'x-webhook-secret': 'segredo-webhook' },
        body: JSON.stringify(corpo),
      }),
      api(`/webhooks/whatsapp/uazapi/${instanciaId}`, {
        method: 'POST',
        headers: { 'x-webhook-secret': 'segredo-webhook' },
        body: JSON.stringify(corpo),
      }),
    ]);
    assert.deepEqual([um.json.status, dois.json.status].sort(), ['duplicado', 'recebido']);

    const usuarioId = randomUUID();
    const candidatoId = randomUUID();
    await repositorioTeste.criarUsuario({
      id: usuarioId,
      email: `${usuarioId}@candidato.test`,
      senhaHash: 'x',
      papeisGlobais: [],
      mfaAtivo: false,
      mfaSecretCifrado: null,
      visaoPreferida: 'CANDIDATO',
      emailConfirmadoEm: agora,
    });
    await repositorioTeste.criarCandidato({ id: candidatoId, usuarioId, nome: 'Candidato Multi' });
    const perfil = await repositorioTeste.obterPerfil(usuarioId);
    assert.ok(perfil);
    await repositorioTeste.salvarPerfil({
      ...perfil,
      whatsapp: '5511900000001',
      whatsappVerificado: true,
      whatsappVerificadoEm: agora,
    });
    for (const tipo of ['WHATSAPP', 'AUDIO_WHATSAPP'] as const) {
      await repositorioTeste.registrarConsentimento({
        id: randomUUID(),
        candidatoId,
        tipo,
        concedido: true,
        versaoTermo: 'v1',
        criadoEm: agora,
      });
    }
    const empresas = await Promise.all([
      empresaMemoria('Oficina Alfa'),
      empresaMemoria('Oficina Beta'),
      empresaMemoria('Oficina Gama'),
    ]);
    const titulos = ['Vaga Alfa', 'Vaga Beta', 'Vaga Gama'];
    const numeros = ['5511900000011', '5511900000022', '5511900000033'];
    const cenarios = [];
    for (let i = 0; i < 3; i += 1) {
      cenarios.push(await triagemDe(empresas[i]!, candidatoId, titulos[i]!, numeros[i]!));
    }
    for (const item of cenarios) {
      const inicio = await interno(`/interno/triagem/candidaturas/${item.candidaturaId}/iniciar`);
      assert.equal(inicio.json.iniciada, true, JSON.stringify(inicio.json));
    }
    for (const titulo of titulos) {
      assert.ok(
        whatsappMensagensTeste.enviados.some((item) => String(item.texto).includes(`vaga "${titulo}"`)),
        titulo,
      );
    }
    const extra = await triagemDe(empresas[0]!, candidatoId, 'Vaga Alfa extra', numeros[0]!);
    const fila = await interno(`/interno/triagem/candidaturas/${extra.candidaturaId}/iniciar`);
    assert.equal(fila.json.motivo, 'FILA_DA_EMPRESA');
    const entrevista = await repositorioTeste.buscarEntrevistaPorCandidaturaEtapa(extra.candidaturaId, extra.etapaId, SISTEMA);
    assert.equal(entrevista?.status, 'AGENDADA');
  });

  it('recalcula várias vagas em paralelo sem perder score e mede a voz local', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 8; i += 1) {
      const empresaId = await empresaMemoria(`Carga ${i}`);
      const pessoa = await candidato(`Carga ${i}`);
      const vaga = await vozDe(empresaId, pessoa.candidatoId);
      ids.push(vaga.vagaId);
    }
    const resultados = await Promise.all(
      ids.map((vagaId) => interno(`/interno/ranking/vagas/${vagaId}/recalcular`, { forcar: true })),
    );
    assert.ok(resultados.every((item) => item.status === 200 && item.json.adiado === false));
    const scores = await repositorioTeste.listarScores(SISTEMA);
    assert.equal(scores.length, 8);

    const amostras = await Promise.all(
      Array.from({ length: 24 }, (_, indice) => medirPipelineFake(`resposta ficticia ${indice}`)),
    );
    const p50 = percentil50(amostras.map((item) => item.totalMs));
    assert.ok(p50 < 1000, `p50 ${p50}`);

    const painel = await api('/interno/capacidade', { headers: { 'x-internal-token': 'job-teste' } });
    assert.equal(painel.status, 200, JSON.stringify(painel.json));
    assert.equal((painel.json.cotas as { vozSimultaneasPorEmpresa: number }).vozSimultaneasPorEmpresa, 4);
    assert.equal(typeof (painel.json.instancias as { conectadas: number }).conectadas, 'number');
  });
});
