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
process.env.SIMULADOR_ENTREVISTA = 'true';
process.env.LOG_LEVEL = 'silent';

import { limparAmbienteTeste, relogioTeste, repositorioTeste, whatsappMensagensTeste } from '../src/ambiente-teste';
import { lerConfiguracao } from '../src/configuracao';
import { gravadorSimulador } from '../src/simulador/gravador-whatsapp';

const SISTEMA = { sistema: true as const };
const AGORA = new Date('2026-10-07T15:00:00.000Z');
const RESPOSTA_CURTA = 'Fiz a tarefa.';
const RESPOSTA_LONGA =
  'No último trimestre priorizei um incidente com a equipe. Isolamos a causa numa consulta lenta e o tempo caiu de 4 segundos para 200 milissegundos. Documentei o resultado.';

let app: INestApplication;
let base = '';

async function api(caminho: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const resposta = await fetch(`${base}${caminho}`, { ...init, headers });
  const texto = await resposta.text();
  return { status: resposta.status, json: texto ? (JSON.parse(texto) as Record<string, unknown>) : {} };
}

async function cenarioSemInstancia(): Promise<{ numero: string; vagaId: string }> {
  const empresaId = randomUUID();
  const usuarioEmpresaId = randomUUID();
  const usuarioCandidatoId = randomUUID();
  const candidatoId = randomUUID();
  const vagaId = randomUUID();
  const processoId = randomUUID();
  const etapaId = randomUUID();
  const candidaturaId = randomUUID();
  const numero = '5511900000001';
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
        horarioComercial: false,
        prazoInatividadeHoras: 24,
      },
      janelaReconexaoSegundos: 60,
    },
    SISTEMA,
  );
  await repositorioTeste.salvarEtapa(
    { id: etapaId, processoId, ordem: 1, tipo: 'TRIAGEM_WHATSAPP', numeroPerguntas: 2 },
    SISTEMA,
  );
  for (let ordem = 1; ordem <= 2; ordem += 1) {
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
  return { numero, vagaId };
}

function textos(json: Record<string, unknown>): string[] {
  const mensagens = json.mensagens;
  assert.ok(Array.isArray(mensagens));
  return mensagens.map((item) => String((item as { texto?: unknown }).texto ?? ''));
}

describe('simulador de entrevista', () => {
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
    gravadorSimulador.limpar();
    relogioTeste.definir(AGORA);
  });

  it('conduz a triagem pelo webhook falso e grava a avaliação sem chamar a Uazapi', async () => {
    const { numero } = await cenarioSemInstancia();
    const status = await api('/dev/simulador/status');
    assert.equal(status.status, 200);
    assert.equal(status.json.ativo, true);

    const preparado = await api('/dev/simulador/preparar', {
      method: 'POST',
      body: JSON.stringify({ numero }),
    });
    assert.equal(preparado.status, 201, JSON.stringify(preparado.json));
    const convite = textos(preparado.json).join('\n');
    assert.match(convite, /Começar|triagem/i);
    assert.equal(whatsappMensagensTeste.enviados.length, 0);
    assert.ok(gravadorSimulador.enviados.length > 0);

    const comecar = await api('/dev/simulador/entrada', {
      method: 'POST',
      body: JSON.stringify({ numero, texto: 'Começar', botaoId: 'comecar' }),
    });
    assert.equal(comecar.status, 201, JSON.stringify(comecar.json));
    assert.match(textos(comecar.json).join('\n'), /Pergunta 1/);

    const pedido = await api('/dev/simulador/entrada', {
      method: 'POST',
      body: JSON.stringify({ numero, texto: RESPOSTA_CURTA }),
    });
    assert.equal(pedido.status, 201, JSON.stringify(pedido.json));
    assert.match(textos(pedido.json).join('\n'), /pode responder em texto/i);

    const primeira = await api('/dev/simulador/entrada', {
      method: 'POST',
      body: JSON.stringify({ numero, texto: RESPOSTA_CURTA }),
    });
    assert.equal(primeira.status, 201, JSON.stringify(primeira.json));
    const depoisDaCurta = textos(primeira.json).join('\n');
    assert.match(depoisDaCurta, /Pergunta 2/);
    assert.match(depoisDaCurta, /Ficou curta|ficou curta|Fiz a tarefa/);

    const segunda = await api('/dev/simulador/entrada', {
      method: 'POST',
      body: JSON.stringify({ numero, texto: RESPOSTA_LONGA }),
    });
    assert.equal(segunda.status, 201, JSON.stringify(segunda.json));
    const fim = textos(segunda.json).join('\n');
    assert.match(fim, /Recebemos suas respostas da triagem/);
    assert.doesNotMatch(fim, /nota\s*[:=]?\s*\d/i);

    const conversa = await api(`/dev/simulador/conversa?numero=${numero}`);
    assert.equal(conversa.status, 200, JSON.stringify(conversa.json));
    assert.equal((conversa.json.entrevista as { status?: string } | null)?.status, 'CONCLUIDA');
    const avaliacoes = conversa.json.avaliacoes as Array<{ nota: number; justificativa: string }>;
    assert.equal(avaliacoes.length, 2);
    assert.ok(avaliacoes[0]!.nota < avaliacoes[1]!.nota);
    assert.match(avaliacoes[1]!.justificativa, /200 milissegundos/);

    const entrevistaId = (conversa.json.entrevista as { id: string }).id;
    const respostas = await repositorioTeste.listarRespostasEntrevista(entrevistaId, SISTEMA);
    for (const resposta of respostas) {
      const notas = await repositorioTeste.listarAvaliacoes(resposta.id, SISTEMA);
      const ia = notas.find((item) => item.avaliador === 'IA');
      assert.equal(ia?.modelo, 'entrevistador-simulado');
    }
    assert.equal(whatsappMensagensTeste.enviados.length, 0);
    assert.ok(gravadorSimulador.enviados.every((item) => !('http' in item)));
  });
});

describe('simulador — configuração', () => {
  it('recusa produção e exige o segredo do webhook quando a flag está ligada', () => {
    assert.throws(
      () =>
        lerConfiguracao({
          NODE_ENV: 'production',
          JWT_SECRET: 'segredo-de-teste-com-32-bytes!!',
          API_PUBLIC_URL: 'https://api.exemplo.com.br',
          SIMULADOR_ENTREVISTA: 'true',
          UAZAPI_WEBHOOK_SECRET: 's',
        }),
      /produção/,
    );
    assert.throws(
      () =>
        lerConfiguracao({
          NODE_ENV: 'development',
          JWT_SECRET: 'segredo-de-teste-com-32-bytes!!',
          API_PUBLIC_URL: 'http://localhost:3000',
          SIMULADOR_ENTREVISTA: 'true',
        }),
      /UAZAPI_WEBHOOK_SECRET/,
    );
  });
});
