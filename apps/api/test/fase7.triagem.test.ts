import 'reflect-metadata';

import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { after, before, beforeEach, describe, it } from 'node:test';

import type { INestApplication } from '@nestjs/common';
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
  emailTeste,
  filaTriagemTeste,
  fonteCnpjTeste,
  limparAmbienteTeste,
  relogioTeste,
  repositorioTeste,
  whatsappMensagensTeste,
  whatsappTeste,
} from '../src/ambiente-teste';
import { extrairCodigo } from '../src/auth/segredos';
import { EnviadorWhatsapp } from '../src/triagem/enviador-whatsapp';

const SISTEMA = { sistema: true as const };
const AGORA = new Date('2026-10-07T15:00:00.000Z');
const SABADO = new Date('2026-10-10T15:00:00.000Z');
const SEGUNDA = '2026-10-12T12:00:00.000Z';
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
  etapaId: string;
  candidaturaId: string;
  candidatoId: string;
  instanciaId: string;
  tokenInstancia: string;
  numero: string;
  usuarioEmpresaId: string;
}

async function cenario(opcoes?: {
  optIn?: boolean;
  verificado?: boolean;
  conectada?: boolean;
  perguntas?: number;
  horarioComercial?: boolean;
  numero?: string;
  nome?: string;
}): Promise<Cenario> {
  const empresaId = randomUUID();
  const usuarioEmpresaId = randomUUID();
  const usuarioCandidatoId = randomUUID();
  const candidatoId = randomUUID();
  const vagaId = randomUUID();
  const processoId = randomUUID();
  const etapaId = randomUUID();
  const candidaturaId = randomUUID();
  const instanciaId = randomUUID();
  const tokenInstancia = `tok-${instanciaId.slice(0, 8)}`;
  const numero = opcoes?.numero ?? '5511900000001';
  const agora = relogioTeste.agora();
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
      nomeFantasia: opcoes?.nome ?? 'Alfa',
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
  const perfil = await repositorioTeste.obterPerfil(usuarioCandidatoId);
  assert.ok(perfil);
  await repositorioTeste.salvarPerfil({
    ...perfil,
    whatsapp: numero,
    whatsappVerificado: opcoes?.verificado !== false,
    whatsappVerificadoEm: opcoes?.verificado === false ? null : agora,
  });
  if (opcoes?.optIn !== false) {
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
        horarioComercial: opcoes?.horarioComercial !== false,
        prazoInatividadeHoras: 24,
      },
      janelaReconexaoSegundos: 60,
    },
    SISTEMA,
  );
  await repositorioTeste.salvarEtapa(
    { id: etapaId, processoId, ordem: 1, tipo: 'TRIAGEM_WHATSAPP', numeroPerguntas: opcoes?.perguntas ?? 5 },
    SISTEMA,
  );
  const total = opcoes?.perguntas ?? 5;
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
        tempoLimiteSegundos: 180,
      },
      SISTEMA,
    );
    await repositorioTeste.vincularPergunta(
      { id: randomUUID(), etapaId, perguntaId, ordem, peso: 1, tempoLimiteSegundos: null },
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
  const conectada = opcoes?.conectada !== false;
  await repositorioTeste.salvarInstancia(
    {
      id: instanciaId,
      empresaId,
      instanciaIdProvedorCifrado: cifrar(`prov-${instanciaId.slice(0, 8)}`, CHAVE),
      tokenCifrado: cifrar(tokenInstancia, CHAVE),
      numero: '5511900000099',
      status: conectada ? 'CONECTADA' : 'DESCONECTADA',
      ultimaConexaoEm: conectada ? agora : null,
      desconectadaEm: conectada ? null : agora,
    },
    SISTEMA,
  );
  if (conectada) whatsappTeste.conectadas.add(tokenInstancia);
  return {
    empresaId,
    vagaId,
    etapaId,
    candidaturaId,
    candidatoId,
    instanciaId,
    tokenInstancia,
    numero,
    usuarioEmpresaId,
  };
}

async function webhook(instanciaId: string, token: string, message: Record<string, unknown>) {
  return api(`/webhooks/whatsapp/uazapi/${instanciaId}`, {
    method: 'POST',
    headers: { 'x-webhook-secret': 'segredo-webhook' },
    body: JSON.stringify({ token, message }),
  });
}

async function processarUltimo(instanciaId: string, token: string, message: Record<string, unknown>) {
  const recebido = await webhook(instanciaId, token, message);
  assert.equal(recebido.status, 201, JSON.stringify(recebido.json));
  const eventoId = String(recebido.json.eventoId);
  const proc = await interno(`/interno/triagem/eventos/${eventoId}/processar`);
  assert.equal(proc.status, 200, JSON.stringify(proc.json));
  return proc.json;
}

describe('F7 triagem WhatsApp', () => {
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
  });

  it('conclui cinco áudios com transcrição, nota e aviso de tentativa única', async () => {
    const baseCenario = await cenario();
    const inicio = await interno(`/interno/triagem/candidaturas/${baseCenario.candidaturaId}/iniciar`);
    assert.equal(inicio.json.iniciada, true, JSON.stringify(inicio.json));
    const convite = whatsappMensagensTeste.enviados.find((item) => item.tipo === 'menu');
    assert.match(String(convite?.texto), /não pode ser refeita/);
    const comecar = await processarUltimo(baseCenario.instanciaId, baseCenario.tokenInstancia, {
      messageid: 'btn-comecar',
      sender: `${baseCenario.numero}@s.whatsapp.net`,
      messageType: 'ButtonResponse',
      buttonOrListid: 'comecar',
      text: 'Começar',
    });
    assert.equal(comecar.decisao, 'ACEITAR_INICIO');
    const antes = await repositorioTeste.buscarEntrevistaPorCandidaturaEtapa(
      baseCenario.candidaturaId,
      baseCenario.etapaId,
      SISTEMA,
    );
    assert.equal(antes?.iniciadaEm, null);

    for (let ordem = 1; ordem <= 5; ordem += 1) {
      const id = `audio-${ordem}`;
      whatsappMensagensTeste.programarMidia(id, {
        base64: Buffer.from(`audio-${ordem}`).toString('base64'),
        mimetype: 'audio/ogg',
      });
      const proc = await processarUltimo(baseCenario.instanciaId, baseCenario.tokenInstancia, {
        messageid: id,
        sender: `${baseCenario.numero}@s.whatsapp.net`,
        messageType: 'AudioMessage',
        content: { seconds: 4, mimetype: 'audio/ogg' },
      });
      assert.equal(proc.status, 'PROCESSADO', JSON.stringify(proc));
      const transcricao = await interno(`/interno/triagem/respostas/${String(proc.respostaId)}/transcrever`);
      assert.equal(transcricao.status, 200, JSON.stringify(transcricao.json));
    }

    const entrevista = await repositorioTeste.buscarEntrevistaPorCandidaturaEtapa(
      baseCenario.candidaturaId,
      baseCenario.etapaId,
      SISTEMA,
    );
    assert.equal(entrevista?.status, 'CONCLUIDA');
    assert.ok(entrevista?.iniciadaEm);
    const respostas = await repositorioTeste.listarRespostasEntrevista(entrevista!.id, SISTEMA);
    assert.equal(respostas.length, 5);
    for (const resposta of respostas) {
      assert.equal(resposta.tipo, 'AUDIO_WHATSAPP');
      assert.equal(resposta.statusTranscricao, 'CONCLUIDA');
      assert.match(String(resposta.audioUrl), /respostas\//);
      assert.equal(resposta.transcricao, 'resposta de teste');
      const notas = await repositorioTeste.listarAvaliacoes(resposta.id, SISTEMA);
      assert.equal(notas.some((item) => item.avaliador === 'IA' && item.nota === 8), true);
      assert.equal(JSON.stringify(notas).includes(baseCenario.numero), false);
    }
    const candidatura = await repositorioTeste.buscarCandidatura(baseCenario.candidaturaId, SISTEMA);
    assert.equal(candidatura?.status, 'TRIAGEM_CONCLUIDA');
    const repetida = await interno(`/interno/triagem/candidaturas/${baseCenario.candidaturaId}/iniciar`);
    assert.equal(repetida.status, 409);
  });

  it('trata o mesmo webhook duas vezes como uma resposta', async () => {
    const baseCenario = await cenario({ perguntas: 1 });
    await interno(`/interno/triagem/candidaturas/${baseCenario.candidaturaId}/iniciar`);
    await processarUltimo(baseCenario.instanciaId, baseCenario.tokenInstancia, {
      messageid: 'btn-comecar',
      sender: `${baseCenario.numero}@s.whatsapp.net`,
      messageType: 'ButtonResponse',
      buttonOrListid: 'comecar',
    });
    whatsappMensagensTeste.programarMidia('audio-dup', {
      base64: Buffer.from('audio').toString('base64'),
      mimetype: 'audio/ogg',
    });
    const mensagem = {
      messageid: 'audio-dup',
      sender: `${baseCenario.numero}@s.whatsapp.net`,
      messageType: 'AudioMessage',
      content: { seconds: 3, mimetype: 'audio/ogg' },
    };
    const primeiro = await webhook(baseCenario.instanciaId, baseCenario.tokenInstancia, mensagem);
    const segundo = await webhook(baseCenario.instanciaId, baseCenario.tokenInstancia, mensagem);
    assert.equal(segundo.json.status, 'duplicado');
    await interno(`/interno/triagem/eventos/${String(primeiro.json.eventoId)}/processar`);
    const entrevista = await repositorioTeste.buscarEntrevistaPorCandidaturaEtapa(
      baseCenario.candidaturaId,
      baseCenario.etapaId,
      SISTEMA,
    );
    const respostas = await repositorioTeste.listarRespostasEntrevista(entrevista!.id, SISTEMA);
    assert.equal(respostas.length, 1);
  });

  it('não envia sem opt-in e não inicia a fase sem instância conectada', async () => {
    const semOptIn = await cenario({ optIn: false });
    const antes = whatsappMensagensTeste.enviados.length;
    const recusa = await interno(`/interno/triagem/candidaturas/${semOptIn.candidaturaId}/iniciar`);
    assert.equal(recusa.json.motivo, 'SEM_OPT_IN');
    assert.equal(whatsappMensagensTeste.enviados.length, antes);
    assert.equal(
      (await repositorioTeste.buscarCandidatura(semOptIn.candidaturaId, SISTEMA))?.status,
      'INSCRITA',
    );

    const semInstancia = await cenario({ conectada: false, numero: '5511900000002' });
    const bloqueio = await interno(`/interno/triagem/candidaturas/${semInstancia.candidaturaId}/iniciar`);
    assert.equal(bloqueio.json.motivo, 'INSTANCIA_INDISPONIVEL');
    assert.equal(
      (await repositorioTeste.buscarCandidatura(semInstancia.candidaturaId, SISTEMA))?.status,
      'INSCRITA',
    );
    const avisos = await repositorioTeste.listarNotificacoes(
      { usuarioId: semInstancia.usuarioEmpresaId, pagina: 1, limite: 10 },
      { empresaId: semInstancia.empresaId },
    );
    assert.equal(avisos.itens.some((item) => item.tipo === 'OPERACIONAL'), true);
  });

  it('não roteia mensagem da instância A para a entrevista da empresa B', async () => {
    const empresaA = await cenario({ numero: '5511900000003', nome: 'Empresa A' });
    const empresaB = await cenario({ numero: '5511900000004', nome: 'Empresa B' });
    await interno(`/interno/triagem/candidaturas/${empresaB.candidaturaId}/iniciar`);
    const recebido = await webhook(empresaA.instanciaId, empresaA.tokenInstancia, {
      messageid: 'cruzada',
      sender: `${empresaB.numero}@s.whatsapp.net`,
      messageType: 'Conversation',
      text: 'oi',
    });
    const proc = await interno(`/interno/triagem/eventos/${String(recebido.json.eventoId)}/processar`);
    assert.equal(proc.json.status, 'IGNORADO');
    const entrevistaB = await repositorioTeste.buscarEntrevistaPorCandidaturaEtapa(
      empresaB.candidaturaId,
      empresaB.etapaId,
      SISTEMA,
    );
    const respostas = await repositorioTeste.listarRespostasEntrevista(entrevistaB!.id, SISTEMA);
    assert.equal(respostas.length, 0);
  });

  it('respeita o limite por instância e o opt-out', async () => {
    const baseCenario = await cenario({ numero: '5511900000005' });
    const enviador = app.get(EnviadorWhatsapp);
    whatsappMensagensTeste.limpar();
    let bloqueios = 0;
    for (let indice = 0; indice < 21; indice += 1) {
      const envio = await enviador.enviar({
        empresaId: baseCenario.empresaId,
        candidatoId: baseCenario.candidatoId,
        numero: baseCenario.numero,
        texto: `Vaga "Pessoa analista" (Alfa). mensagem ${indice}`,
      });
      if (!envio.ok) bloqueios += 1;
    }
    assert.equal(bloqueios, 1);
    assert.equal(whatsappMensagensTeste.enviados.length, 20);

    const outro = await cenario({ optIn: false, numero: '5511900000006' });
    const antes = whatsappMensagensTeste.enviados.length;
    const recusa = await enviador.enviar({
      empresaId: outro.empresaId,
      candidatoId: outro.candidatoId,
      numero: outro.numero,
      texto: 'não deve sair',
    });
    assert.equal(recusa.ok, false);
    assert.equal(whatsappMensagensTeste.enviados.length, antes);

    await interno(`/interno/triagem/candidaturas/${baseCenario.candidaturaId}/iniciar`);
    await processarUltimo(baseCenario.instanciaId, baseCenario.tokenInstancia, {
      messageid: 'parar-1',
      sender: `${baseCenario.numero}@s.whatsapp.net`,
      messageType: 'Conversation',
      text: 'PARAR',
    });
    const depois = whatsappMensagensTeste.enviados.length;
    const retry = await interno(`/interno/triagem/entrevistas/${(await repositorioTeste.buscarEntrevistaPorCandidaturaEtapa(baseCenario.candidaturaId, baseCenario.etapaId, SISTEMA))!.id}/retry`, {
      numero: 1,
    });
    assert.equal(retry.json.enviado, false);
    assert.equal(whatsappMensagensTeste.enviados.length, depois);
  });

  it('agenda retry em horário comercial, congela na pausa e cancela no fechamento', async () => {
    relogioTeste.definir(SABADO);
    const baseCenario = await cenario();
    await interno(`/interno/triagem/candidaturas/${baseCenario.candidaturaId}/iniciar`);
    const entrevista = await repositorioTeste.buscarEntrevistaPorCandidaturaEtapa(
      baseCenario.candidaturaId,
      baseCenario.etapaId,
      SISTEMA,
    );
    assert.equal(entrevista?.proximoRetryEm?.toISOString(), SEGUNDA);
    const job = filaTriagemTeste.jobs.find((item) => item.jobId.startsWith(`retry:${entrevista?.id}`));
    assert.ok(job);
    assert.equal(new Date(SABADO.getTime() + job.delayMs).toISOString(), SEGUNDA);

    const pausaId = randomUUID();
    await repositorioTeste.registrarEventoVaga(
      {
        id: pausaId,
        empresaId: baseCenario.empresaId,
        vagaId: baseCenario.vagaId,
        tipo: 'VagaPausada',
        payload: {},
        criadoEm: SABADO,
        consumidoEm: null,
      },
      SISTEMA,
    );
    assert.equal((await interno(`/interno/eventos-vaga/${pausaId}/aplicar`)).status, 201);
    const suspensa = await repositorioTeste.buscarEntrevista(entrevista!.id, SISTEMA);
    assert.equal(suspensa?.status, 'SUSPENSA_PAUSA');
    relogioTeste.definir(new Date(SEGUNDA));
    const durantePausa = await interno(`/interno/triagem/entrevistas/${entrevista!.id}/retry`, { numero: 1 });
    assert.equal(durantePausa.json.motivo, 'suspensa');
    assert.equal((await repositorioTeste.buscarEntrevista(entrevista!.id, SISTEMA))?.retryAtual, 0);

    const retomadaId = randomUUID();
    await repositorioTeste.registrarEventoVaga(
      {
        id: retomadaId,
        empresaId: baseCenario.empresaId,
        vagaId: baseCenario.vagaId,
        tipo: 'VagaRetomada',
        payload: {},
        criadoEm: new Date(SEGUNDA),
        consumidoEm: null,
      },
      SISTEMA,
    );
    await interno(`/interno/eventos-vaga/${retomadaId}/aplicar`);
    assert.notEqual((await repositorioTeste.buscarEntrevista(entrevista!.id, SISTEMA))?.status, 'SUSPENSA_PAUSA');

    const fechaId = randomUUID();
    await repositorioTeste.registrarEventoVaga(
      {
        id: fechaId,
        empresaId: baseCenario.empresaId,
        vagaId: baseCenario.vagaId,
        tipo: 'VagaFechada',
        payload: { motivo: 'vaga encerrada' },
        criadoEm: new Date(SEGUNDA),
        consumidoEm: null,
      },
      SISTEMA,
    );
    await interno(`/interno/eventos-vaga/${fechaId}/aplicar`);
    assert.equal((await repositorioTeste.buscarEntrevista(entrevista!.id, SISTEMA))?.status, 'CANCELADA');
  });

  it('pausa a empresa desconectada sem consumir tentativa e segue com as demais', async () => {
    const alfa = await cenario({ numero: '5511900000007', nome: 'Alfa' });
    const beta = await cenario({ numero: '5511900000008', nome: 'Beta' });
    await interno(`/interno/triagem/candidaturas/${alfa.candidaturaId}/iniciar`);
    await interno(`/interno/triagem/candidaturas/${beta.candidaturaId}/iniciar`);
    whatsappTeste.conectadas.delete(alfa.tokenInstancia);
    whatsappTeste.falharStatus.add('token-quebrado');
    const varredura = await interno('/interno/triagem/monitorar');
    assert.equal(varredura.status, 200);
    const entrevistaAlfa = await repositorioTeste.buscarEntrevistaPorCandidaturaEtapa(
      alfa.candidaturaId,
      alfa.etapaId,
      SISTEMA,
    );
    assert.equal(entrevistaAlfa?.status, 'SUSPENSA_INSTANCIA');
    const instancia = await repositorioTeste.buscarInstanciaPorEmpresa(alfa.empresaId, SISTEMA);
    assert.equal(instancia?.status, 'DESCONECTADA');
    const avisos = await repositorioTeste.listarNotificacoes(
      { usuarioId: alfa.usuarioEmpresaId, pagina: 1, limite: 10 },
      { empresaId: alfa.empresaId },
    );
    assert.equal(avisos.itens.some((item) => item.tipo === 'WHATSAPP_DESCONECTADO'), true);
    relogioTeste.definir(new Date(SEGUNDA));
    const retry = await interno(`/interno/triagem/entrevistas/${entrevistaAlfa!.id}/retry`, { numero: 1 });
    assert.equal(retry.json.motivo, 'suspensa');
    assert.equal((await repositorioTeste.buscarEntrevista(entrevistaAlfa!.id, SISTEMA))?.retryAtual, 0);

    const entrevistaBeta = await repositorioTeste.buscarEntrevistaPorCandidaturaEtapa(
      beta.candidaturaId,
      beta.etapaId,
      SISTEMA,
    );
    assert.equal(entrevistaBeta?.status, 'AGUARDANDO_INICIO');
    const envioBeta = await interno(`/interno/triagem/entrevistas/${entrevistaBeta!.id}/retry`, { numero: 1 });
    assert.equal(envioBeta.json.enviado, true, JSON.stringify(envioBeta.json));
  });

  it('lembra na metade do prazo, abandona com avaliação parcial e desempata com resposta simultânea', async () => {
    const baseCenario = await cenario({ perguntas: 2, numero: '5511900000009' });
    await interno(`/interno/triagem/candidaturas/${baseCenario.candidaturaId}/iniciar`);
    await processarUltimo(baseCenario.instanciaId, baseCenario.tokenInstancia, {
      messageid: 'btn-2',
      sender: `${baseCenario.numero}@s.whatsapp.net`,
      messageType: 'ButtonResponse',
      buttonOrListid: 'comecar',
    });
    whatsappMensagensTeste.programarMidia('audio-parcial', {
      base64: Buffer.from('audio').toString('base64'),
      mimetype: 'audio/ogg',
    });
    const proc = await processarUltimo(baseCenario.instanciaId, baseCenario.tokenInstancia, {
      messageid: 'audio-parcial',
      sender: `${baseCenario.numero}@s.whatsapp.net`,
      messageType: 'AudioMessage',
      content: { seconds: 5, mimetype: 'audio/ogg' },
    });
    await interno(`/interno/triagem/respostas/${String(proc.respostaId)}/transcrever`);
    const entrevista = await repositorioTeste.buscarEntrevistaPorCandidaturaEtapa(
      baseCenario.candidaturaId,
      baseCenario.etapaId,
      SISTEMA,
    );
    assert.equal(entrevista?.status, 'AGUARDANDO_RESPOSTA');
    const meio = new Date(AGORA.getTime() + 12 * 60 * 60 * 1000);
    relogioTeste.definir(meio);
    const lembrete = await interno(
      `/interno/triagem/entrevistas/${entrevista!.id}/abandonar-inatividade`,
      { ultimaInteracaoEm: entrevista!.ultimaInteracaoEm!.toISOString() },
    );
    assert.equal(lembrete.json.abandonada, false, JSON.stringify(lembrete.json));
    assert.equal(lembrete.json.lembrete, true);
    assert.notEqual((await repositorioTeste.buscarEntrevista(entrevista!.id, SISTEMA))?.status, 'ABANDONADA');

    const prazo = new Date(AGORA.getTime() + 24 * 60 * 60 * 1000);
    relogioTeste.definir(prazo);
    whatsappMensagensTeste.programarMidia('audio-corrida', {
      base64: Buffer.from('audio').toString('base64'),
      mimetype: 'audio/ogg',
    });
    const mensagem = {
      messageid: 'audio-corrida',
      sender: `${baseCenario.numero}@s.whatsapp.net`,
      messageType: 'AudioMessage',
      content: { seconds: 4, mimetype: 'audio/ogg' },
    };
    const recebido = await webhook(baseCenario.instanciaId, baseCenario.tokenInstancia, mensagem);
    const [abandono, processamento] = await Promise.all([
      interno(`/interno/triagem/entrevistas/${entrevista!.id}/abandonar-inatividade`, {
        ultimaInteracaoEm: entrevista!.ultimaInteracaoEm!.toISOString(),
      }),
      interno(`/interno/triagem/eventos/${String(recebido.json.eventoId)}/processar`),
    ]);
    const final = await repositorioTeste.buscarEntrevista(entrevista!.id, SISTEMA);
    const respostas = await repositorioTeste.listarRespostasEntrevista(entrevista!.id, SISTEMA);
    const abandonou = final?.status === 'ABANDONADA';
    const respondeu = respostas.some((item) => item.mensagemIdProvedor === 'audio-corrida');
    assert.equal(abandonou && respondeu, false, JSON.stringify({ abandono: abandono.json, processamento: processamento.json, status: final?.status }));
    if (abandonou) {
      assert.equal((await repositorioTeste.buscarCandidatura(baseCenario.candidaturaId, SISTEMA))?.status, 'TRIAGEM_ABANDONADA');
      const avaliadas = await repositorioTeste.listarAvaliacoes(String(proc.respostaId), SISTEMA);
      assert.equal(avaliadas.length > 0, true);
    }
  });

  it('mostra triagem à empresa, audita o áudio e esconde a nota do candidato', async () => {
    relogioTeste.definir(AGORA);
    const dona = await empresaVerificada('dona-triagem@example.com', '11.222.333/0001-81');
    const outra = await empresaVerificada('outra-triagem@example.com', '22.333.444/0001-81');
    const candidato = await registrar('cand-triagem@example.com');
    const entrevistaId = randomUUID();
    const respostaId = randomUUID();
    const candidaturaId = randomUUID();
    const vagaId = randomUUID();
    const agora = AGORA;
    await repositorioTeste.criarVaga(
      {
        id: vagaId,
        empresaId: dona.empresaId,
        titulo: 'Vaga visível',
        descricao: 'Descrição',
        senioridade: 'JUNIOR',
        modelo: 'REMOTO',
        localidade: null,
        tipoContrato: null,
        faixaSalarialMin: null,
        faixaSalarialMax: null,
        beneficios: [],
        posicoes: 1,
        status: 'PUBLICADA',
        prazoInscricoes: null,
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
    await repositorioTeste.criarCandidatura(
      {
        id: candidaturaId,
        empresaId: dona.empresaId,
        vagaId,
        candidatoId: randomUUID(),
        origem: 'DIRETA',
        status: 'TRIAGEM_CONCLUIDA',
        statusAntesDaEspera: null,
        etapaAtualId: null,
        criadoEm: agora,
        atualizadoEm: agora,
      },
      {
        id: randomUUID(),
        candidaturaId,
        de: 'INSCRITA',
        para: 'TRIAGEM_CONCLUIDA',
        autorId: null,
        motivo: null,
        criadoEm: agora,
      },
      SISTEMA,
    );
    await repositorioTeste.criarEntrevista(
      {
        id: entrevistaId,
        empresaId: dona.empresaId,
        candidaturaId,
        etapaId: randomUUID(),
        canal: 'WHATSAPP',
        status: 'CONCLUIDA',
        retryAtual: 0,
        perguntaAtual: 1,
        iniciadaEm: agora,
        ultimaInteracaoEm: agora,
        proximoRetryEm: null,
        aceiteTentativaEm: agora,
        excecaoConcedida: false,
        encerrarAoFim: false,
        criadoEm: agora,
        atualizadoEm: agora,
      },
      SISTEMA,
    );
    await repositorioTeste.guardarResposta({
      id: respostaId,
      empresaId: dona.empresaId,
      entrevistaId,
      tipo: 'AUDIO_WHATSAPP',
      audioUrl: `empresas/${dona.empresaId}/entrevistas/${entrevistaId}/respostas/${respostaId}.ogg`,
      transcricao: 'resposta de teste',
      textoOriginal: null,
      statusTranscricao: 'CONCLUIDA',
      revisaoHumanaNecessaria: false,
      parcial: false,
    });
    await repositorioTeste.salvarAvaliacao(
      {
        id: randomUUID(),
        respostaId,
        avaliador: 'IA',
        nota: 8,
        criterios: { contaNaMedia: true },
        justificativa: 'clara',
        modelo: 'mock',
        versaoPrompt: 'triagem-avaliacao-v1',
        criadoEm: agora,
      },
      { empresaId: dona.empresaId },
    );
    const lista = await api(`/empresas/${dona.empresaId}/vagas/${vagaId}/triagens`, {}, dona.token);
    assert.equal(lista.status, 200, JSON.stringify(lista.json));
    assert.equal((lista.json.itens as unknown[]).length, 1);
    const detalhe = await api(`/empresas/${dona.empresaId}/triagens/${entrevistaId}`, {}, dona.token);
    assert.equal(detalhe.status, 200);
    const resposta = (detalhe.json.respostas as Array<{ nota: number }>)[0];
    assert.equal(resposta?.nota, 8);
    const audio = await api(
      `/empresas/${dona.empresaId}/triagens/${entrevistaId}/respostas/${respostaId}/audio?motivo=revisao%20da%20triagem`,
      {},
      dona.token,
    );
    assert.equal(audio.status, 200, JSON.stringify(audio.json));
    assert.match(String(audio.json.url), /expira=60/);
    const revisao = await api(
      `/empresas/${dona.empresaId}/triagens/${entrevistaId}/respostas/${respostaId}/revisao`,
      { method: 'POST', body: JSON.stringify({ nota: 9, justificativa: 'revisão humana' }) },
      dona.token,
    );
    assert.equal(revisao.status, 201, JSON.stringify(revisao.json));
    assert.equal((revisao.json.respostas as Array<{ nota: number; notaOrigem: string }>)[0]?.nota, 9);
    const cruzada = await api(`/empresas/${outra.empresaId}/triagens/${entrevistaId}`, {}, outra.token);
    assert.equal(cruzada.status, 404);
    const candidatoVe = await api(`/empresas/${dona.empresaId}/triagens/${entrevistaId}`, {}, candidato);
    assert.equal(candidatoVe.status, 403);
    assert.equal(JSON.stringify(candidatoVe.json).includes('nota'), false);
  });
});
