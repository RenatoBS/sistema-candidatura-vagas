import 'reflect-metadata';

import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { after, before, beforeEach, describe, it } from 'node:test';

import type { INestApplication } from '@nestjs/common';
import { vazarRanking } from '@scv/domain';

process.env.NODE_ENV = 'test';
process.env.AUTH_STORE = 'memory';
process.env.JWT_SECRET = 'segredo-de-teste-com-32-bytes!!';
process.env.APP_ENCRYPTION_KEY = randomBytes(32).toString('base64');
process.env.INTERNAL_JOB_TOKEN = 'job-teste';
process.env.API_PUBLIC_URL = 'http://localhost:3000';
process.env.LLM_PROVIDER = 'mock';
process.env.LOG_LEVEL = 'silent';

import { emailTeste, fonteCnpjTeste, limparAmbienteTeste, relogioTeste, repositorioTeste } from '../src/ambiente-teste';
import { extrairCodigo } from '../src/auth/segredos';

const SISTEMA = { sistema: true as const };
const AGORA = new Date('2026-10-07T15:00:00.000Z');

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
    body: JSON.stringify(body ?? {}),
  });
}

async function registrar(email: string) {
  const senha = 'senha1234';
  assert.equal((await api('/auth/cadastro', { method: 'POST', body: JSON.stringify({ email, senha }) })).status, 201);
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
  await api(`/empresas/${empresaId}/verificacao/email`, { method: 'POST', body: JSON.stringify({ codigo }) }, token);
  fonteCnpjTeste.definir(cnpj.replace(/\D/g, ''), { situacaoAtiva: true, razaoSocial: 'Acme Ltda', indisponivel: false });
  await api(`/interno/empresas/${empresaId}/verificar-cnpj`, { method: 'POST', headers: { 'x-internal-token': 'job-teste' } });
  return { empresaId, token };
}

async function avaliacao(respostaId: string, nota: number) {
  await repositorioTeste.salvarAvaliacao(
    {
      id: randomUUID(),
      respostaId,
      avaliador: 'IA',
      nota,
      criterios: { contaNaMedia: true },
      justificativa: 'mock',
      modelo: 'mock-deterministico',
      versaoPrompt: 'voz-avaliacao-v1',
      criadoEm: AGORA,
    },
    SISTEMA,
  );
}

async function fase(
  empresaId: string,
  candidaturaId: string,
  canal: 'WHATSAPP' | 'VOZ_TEMPO_REAL',
  nota: number,
) {
  const entrevistaId = randomUUID();
  const respostaId = randomUUID();
  const agora = relogioTeste.agora();
  await repositorioTeste.criarEntrevista(
    {
      id: entrevistaId,
      empresaId,
      candidaturaId,
      etapaId: randomUUID(),
      canal,
      status: 'CONCLUIDA',
      retryAtual: 0,
      perguntaAtual: 1,
      iniciadaEm: agora,
      ultimaInteracaoEm: agora,
      proximoRetryEm: null,
      aceiteTentativaEm: agora,
      excecaoConcedida: false,
      encerrarAoFim: false,
      contexto: {},
      criadoEm: agora,
      atualizadoEm: agora,
    },
    SISTEMA,
  );
  await repositorioTeste.criarResposta({
    id: respostaId,
    empresaId,
    entrevistaId,
    etapaPerguntaId: randomUUID(),
    tipo: canal === 'WHATSAPP' ? 'AUDIO_WHATSAPP' : 'VOZ_TEMPO_REAL',
    textoOriginal: 'resposta',
    audioUrl: null,
    transcricao: 'resposta',
    statusTranscricao: 'CONCLUIDA',
    expirou: canal === 'VOZ_TEMPO_REAL',
    parcial: false,
    tempoUsado: 10,
  });
  await avaliacao(respostaId, nota);
  return respostaId;
}

async function cenario(empresaId: string, comVoz = true) {
  const usuarioId = randomUUID();
  const candidatoId = randomUUID();
  const vagaId = randomUUID();
  const candidaturaId = randomUUID();
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
  await repositorioTeste.criarCandidato({ id: candidatoId, usuarioId, nome: 'Candidato Alfa' });
  const perfil = await repositorioTeste.obterPerfil(usuarioId);
  assert.ok(perfil);
  await repositorioTeste.salvarPerfil({
    ...perfil,
    nome: 'Candidato Alfa',
    whatsapp: '5511900000001',
    linkedinUrl: 'https://www.linkedin.com/in/candidato-alfa',
    perfil: { resumo: 'Experiência fictícia.' },
  });
  const habilidade = await repositorioTeste.garantirHabilidade('Node');
  await repositorioTeste.definirHabilidades(candidatoId, [
    { habilidadeId: habilidade.id, nivel: 3, anosExperiencia: 2, origem: 'MANUAL' },
  ]);
  await repositorioTeste.criarCurriculo({
    id: randomUUID(),
    candidatoId,
    arquivoKey: `empresas/${empresaId}/cv/${candidatoId}.pdf`,
    mimeType: 'application/pdf',
    tamanhoBytes: 10,
    antivirusStatus: 'LIMPO',
    metodoExtracao: 'NATIVO',
    statusProcessamento: 'CONCLUIDO',
    confiancaOcr: null,
    textoExtraido: 'texto',
    dadosExtraidos: null,
    confirmadoEm: agora,
    aplicadoAoPerfil: true,
    paginas: [],
    criadoEm: agora,
  });
  await repositorioTeste.criarVaga(
    {
      id: vagaId,
      empresaId,
      titulo: 'Pessoa analista',
      descricao: 'Descrição fictícia.',
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
  await repositorioTeste.substituirHabilidades(
    vagaId,
    [{ vagaId, habilidadeId: habilidade.id, nome: 'Node', nivelMinimo: 1, peso: 1, obrigatoria: true }],
    SISTEMA,
  );
  await repositorioTeste.criarCandidatura(
    {
      id: candidaturaId,
      empresaId,
      vagaId,
      candidatoId,
      origem: 'DIRETA',
      status: 'ENTREVISTA_CONCLUIDA',
      statusAntesDaEspera: null,
      etapaAtualId: null,
      criadoEm: agora,
      atualizadoEm: agora,
    },
    {
      id: randomUUID(),
      candidaturaId,
      de: 'ENTREVISTA_CONCLUIDA',
      para: 'ENTREVISTA_CONCLUIDA',
      autorId: null,
      motivo: null,
      criadoEm: agora,
    },
    SISTEMA,
  );
  const respostaTriagem = await fase(empresaId, candidaturaId, 'WHATSAPP', 0);
  if (comVoz) await fase(empresaId, candidaturaId, 'VOZ_TEMPO_REAL', 10);
  return { vagaId, candidaturaId, respostaTriagem };
}

describe('F9 ranqueamento', () => {
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

  it('calcula seis componentes, renormaliza, recalcula pesos e aceita revisão humana', async () => {
    const dona = await empresaVerificada('dona-rank@example.com', '11.222.333/0001-81');
    const completo = await cenario(dona.empresaId, true);
    const primeiro = await interno(`/interno/ranking/vagas/${completo.vagaId}/recalcular`, { forcar: true });
    assert.equal(primeiro.status, 200, JSON.stringify(primeiro.json));
    const item = (primeiro.json.itens as { scoreFinal: number; completude: number; explicacao: { texto: string } }[])[0];
    assert.equal(item?.completude, 1);
    assert.equal(Math.round(item?.scoreFinal ?? 0), 77);
    assert.match(item?.explicacao.texto ?? '', /completo/);
    const deNovo = await interno(`/interno/ranking/vagas/${completo.vagaId}/recalcular`);
    assert.equal(deNovo.json.adiado, true);

    const pesos = await api(
      `/empresas/${dona.empresaId}/vagas/${completo.vagaId}/ranking/pesos`,
      {
        method: 'PUT',
        body: JSON.stringify({ perfil: 10, habilidades: 25, curriculo: 10, linkedin: 2, triagem: 53, voz: 0 }),
      },
      dona.token,
    );
    assert.equal(pesos.status, 200, JSON.stringify(pesos.json));
    const depois = (pesos.json.itens as { candidaturaId: string; scoreFinal: number }[]).find(
      (linha) => linha.candidaturaId === completo.candidaturaId,
    );
    assert.equal(Math.round(depois?.scoreFinal ?? 0), 47);

    const revisao = await api(
      `/empresas/${dona.empresaId}/ranking/respostas/${completo.respostaTriagem}/revisao`,
      { method: 'POST', body: JSON.stringify({ nota: 10, justificativa: 'revisão humana' }) },
      dona.token,
    );
    assert.equal(revisao.status, 200, JSON.stringify(revisao.json));
    assert.equal(Math.round(Number(revisao.json.scoreFinal)), 100);

    const ranking = await api(`/empresas/${dona.empresaId}/vagas/${completo.vagaId}/ranking`, {}, dona.token);
    assert.equal(ranking.status, 200);
    assert.ok(String((ranking.json.itens as { explicacao: { texto: string } }[])[0]?.explicacao.texto).includes('/100'));
    // FC-18/U4: a empresa identifica o candidato pelo primeiro nome (nunca o nome completo) e vê a completude.
    const primeiroItem = (ranking.json.itens as { candidatoNome?: string; completude: number | null }[])[0];
    assert.equal(primeiroItem?.candidatoNome, 'Candidato');
    assert.equal(JSON.stringify(ranking.json).includes('Candidato Alfa'), false);
    const candidaturas = await api(`/vagas/${completo.vagaId}/candidaturas`, { headers: { 'x-empresa-id': dona.empresaId } }, dona.token);
    assert.equal(candidaturas.status, 200, JSON.stringify(candidaturas.json));
    assert.deepEqual(
      (candidaturas.json as unknown as Array<{ candidato: { primeiroNome: string } }>).map((item) => item.candidato),
      [{ primeiroNome: 'Candidato' }],
    );
    assert.equal(JSON.stringify(candidaturas.json).includes('Candidato Alfa'), false);
    const vies = await api(`/empresas/${dona.empresaId}/vagas/${completo.vagaId}/ranking/vies`, {}, dona.token);
    assert.equal(vies.status, 200, JSON.stringify(vies.json));
    assert.ok(Array.isArray(vies.json.distribuicao));

    const candidato = await registrar('cand-rank@example.com');
    await api('/onboarding/candidato', { method: 'POST', body: JSON.stringify({ nome: 'Candidato Beta' }) }, candidato);
    for (const rota of [
      '/candidatos/me',
      '/candidatos/me/habilidades',
      '/candidatos/me/consentimentos',
      '/candidatos/me/candidaturas',
      '/candidatos/me/convites',
      '/vagas-publicas',
    ]) {
      const resposta = await api(rota, {}, candidato);
      assert.ok(resposta.status < 500, rota);
      assert.deepEqual(vazarRanking(resposta.json), [], rota);
    }
    const negado = await api(`/empresas/${dona.empresaId}/vagas/${completo.vagaId}/ranking`, {}, candidato);
    assert.equal(negado.status, 403);
    assert.ok(vazarRanking({ status: 'ok', aninhado: { score: 1 } }).includes('score'));
  });
});
