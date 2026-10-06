import 'reflect-metadata';

import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { after, before, beforeEach, describe, it } from 'node:test';

process.env.NODE_ENV = 'test';
process.env.AUTH_STORE = 'memory';
process.env.JWT_SECRET = 'segredo-de-teste-com-32-bytes!!';
process.env.APP_ENCRYPTION_KEY = randomBytes(32).toString('base64');
process.env.REVISAO_MANUAL_EMPRESA = 'falha';
process.env.INTERNAL_JOB_TOKEN = 'job-teste';
process.env.API_PUBLIC_URL = 'http://localhost:3000';
process.env.LOG_LEVEL = 'silent';
process.env.LLM_PROVIDER = 'mock';
process.env.PAUSA_MAX_DIAS = '30';

import { emailTeste, filaCnpjTeste, fonteCnpjTeste, limparAmbienteTeste, relogioTeste } from '../src/ambiente-teste';
import { extrairCodigo } from '../src/auth/segredos';

const AGORA = new Date('2026-10-06T15:00:00.000Z');
const PRAZO = '2026-11-20T23:59';
const PRAZO_UTC = '2026-11-21T02:59:00.000Z';
const DEPOIS = '2026-12-01T23:59';

let base = '';
let fechar: () => Promise<void> = async () => {};

async function api(caminho: string, init: RequestInit = {}, token?: string) {
  const headers = new Headers(init.headers);
  if (token) headers.set('authorization', `Bearer ${token}`);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const resposta = await fetch(`${base}${caminho}`, { ...init, headers });
  const texto = await resposta.text();
  return { status: resposta.status, json: texto ? (JSON.parse(texto) as Record<string, unknown>) : {} };
}

async function registrar(email: string) {
  const senha = 'senha1234';
  const cadastro = await api('/auth/cadastro', { method: 'POST', body: JSON.stringify({ email, senha }) });
  assert.equal(cadastro.status, 201);
  const codigo = extrairCodigo(emailTeste.ultimoPara(email)?.texto ?? '');
  assert.ok(codigo);
  assert.equal((await api('/auth/confirmar-email', { method: 'POST', body: JSON.stringify({ token: codigo }) })).status, 201);
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
        dominio: 'acme.com.br',
        responsavelNome: 'Ana',
        responsavelEmail: `resp-${cnpj.slice(0, 4)}@acme.com.br`,
      }),
    },
    access,
  );
  assert.equal(criada.status, 201);
  const empresaId = String((criada.json.empresa as { id: string }).id);
  const token = String((criada.json.sessao as { accessToken: string }).accessToken);
  const codigo = extrairCodigo(emailTeste.ultimoPara(`resp-${cnpj.slice(0, 4)}@acme.com.br`)?.texto ?? '');
  assert.ok(codigo);
  assert.equal(
    (await api(`/empresas/${empresaId}/verificacao/email`, { method: 'POST', body: JSON.stringify({ codigo }) }, token)).status,
    201,
  );
  fonteCnpjTeste.definir(cnpj.replace(/\D/g, ''), { situacaoAtiva: true, razaoSocial: 'Acme Ltda', indisponivel: false });
  assert.equal(filaCnpjTeste.jobs.includes(empresaId), true);
  const job = await api(`/interno/empresas/${empresaId}/verificar-cnpj`, {
    method: 'POST',
    headers: { 'x-internal-token': 'job-teste' },
  });
  assert.equal(job.status, 201);
  return { empresaId, token };
}

async function entrar(email: string): Promise<string> {
  const login = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, senha: 'senha1234' }) });
  assert.equal(login.status, 201, JSON.stringify(login.json));
  return String(login.json.accessToken);
}

async function entrarEmpresa(email: string, empresaId: string): Promise<string> {
  const access = await entrar(email);
  const visao = await api(
    '/me/visao',
    { method: 'PATCH', body: JSON.stringify({ visao: 'EMPRESA', empresaId }) },
    access,
  );
  assert.equal(visao.status, 200, JSON.stringify(visao.json));
  return String(visao.json.accessToken);
}

function cnpj(base12: string): string {
  const nums = base12.split('').map(Number);
  const calc = (digitos: number[], pesos: number[]) => {
    const resto = digitos.reduce((soma, digito, indice) => soma + digito * pesos[indice]!, 0) % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const d1 = calc(nums, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = calc([...nums, d1], [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return `${base12}${d1}${d2}`;
}

describe('Fase 4 — ciclo de vida da vaga', () => {
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

  it('publica só com prazo futuro, encerra no relógio e não reabre vaga fechada', async () => {
    const criadaEmpresa = await empresaVerificada('dona@acme.com.br', '11.222.333/0001-81');
    const { empresaId } = criadaEmpresa;
    let { token } = criadaEmpresa;
    const rascunho = await api(
      `/empresas/${empresaId}/vagas`,
      {
        method: 'POST',
        body: JSON.stringify({
          titulo: 'Arquiteto de software',
          descricao: 'Desenhar sistemas distribuídos e orientar o time de engenharia.',
          senioridade: 'SENIOR',
          modelo: 'REMOTO',
          habilidades: [{ nome: 'TypeScript', nivelMinimo: 4, peso: 2, obrigatoria: true }],
        }),
      },
      token,
    );
    assert.equal(rascunho.status, 201);
    const vagaId = String(rascunho.json.id);
    assert.equal(rascunho.json.status, 'RASCUNHO');
    assert.equal(rascunho.json.prazoInscricoes, null);

    const processo = await api(
      `/empresas/${empresaId}/vagas/${vagaId}/processo`,
      {
        method: 'PUT',
        body: JSON.stringify({
          tempoPadraoPorPergunta: 180,
          etapas: [{ ordem: 1, tipo: 'ENTREVISTA_VOZ', numeroPerguntas: 5 }],
        }),
      },
      token,
    );
    assert.equal(processo.status, 200);
    const etapaId = String(((processo.json.processo as { etapas: Array<{ id: string }> }).etapas[0] ?? {}).id);

    const semPrazo = await api(`/empresas/${empresaId}/vagas/${vagaId}/publicar`, { method: 'POST' }, token);
    assert.equal(semPrazo.status, 400);
    assert.equal(semPrazo.json.codigo, 'PRAZO_OBRIGATORIO');

    const patchPrazo = await api(`/empresas/${empresaId}/vagas/${vagaId}`, { method: 'PATCH', body: JSON.stringify({ prazoInscricoes: PRAZO }) }, token);
    assert.equal(patchPrazo.status, 200, JSON.stringify(patchPrazo.json));
    const ainda = await api(`/empresas/${empresaId}/vagas/${vagaId}/publicar`, { method: 'POST' }, token);
    assert.equal(ainda.status, 409, JSON.stringify(ainda.json));
    assert.equal(ainda.json.codigo, 'PERGUNTAS_INCOMPLETAS');

    for (const enunciado of ['Como você decide um limite de serviço?', 'Conte um incidente que você conduziu.']) {
      const criada = await api(
        `/empresas/${empresaId}/vagas/${vagaId}/etapas/${etapaId}/perguntas`,
        {
          method: 'POST',
          body: JSON.stringify({ enunciado, tempoLimiteSegundos: 90, tempoLimiteEtapaSegundos: enunciado.startsWith('Como') ? 45 : null }),
        },
        token,
      );
      assert.equal(criada.status, 201);
    }

    const sugestoes = await api(
      `/empresas/${empresaId}/vagas/${vagaId}/etapas/${etapaId}/perguntas/sugestoes`,
      { method: 'POST' },
      token,
    );
    assert.equal(sugestoes.status, 201);
    const pendentes = sugestoes.json.sugestoes as Array<{ id: string; enunciado: string }>;
    assert.equal(pendentes.length, 3);
    assert.match(pendentes[0]?.enunciado ?? '', /arquitetura/i);
    for (const item of pendentes) {
      const aceita = await api(`/empresas/${empresaId}/perguntas/${item.id}/aceitar`, { method: 'POST', body: JSON.stringify({}) }, token);
      assert.equal(aceita.status, 201);
    }

    const publicada = await api(`/empresas/${empresaId}/vagas/${vagaId}/publicar`, { method: 'POST' }, token);
    assert.equal(publicada.status, 201);
    assert.equal(publicada.json.status, 'PUBLICADA');
    assert.equal(publicada.json.prazoInscricoes, PRAZO_UTC);
    assert.match(String(publicada.json.prazoInscricoesBrasilia), /20\/11\/2026/);
    const perguntas = ((publicada.json.processo as { etapas: Array<{ perguntas: Array<{ tempoLimiteEfetivoSegundos: number }> }> }).etapas[0] ?? {}).perguntas;
    assert.equal(perguntas.length, 5);
    assert.equal(perguntas[0]?.tempoLimiteEfetivoSegundos, 45);
    assert.equal(perguntas[1]?.tempoLimiteEfetivoSegundos, 90);

    const lista = await api('/vagas-publicas');
    assert.equal(lista.status, 200);
    assert.equal((lista.json as unknown as Array<{ id: string }>).some((item) => item.id === vagaId), true);

    const candidato = await registrar('pessoa@email.test');
    const perfil = await api('/onboarding/candidato', { method: 'POST', body: JSON.stringify({ nome: 'Pessoa' }) }, candidato);
    assert.equal(perfil.status, 201);

    relogioTeste.definir(new Date('2026-11-21T03:00:00.000Z'));
    const tokenCandidato = await entrar('pessoa@email.test');
    const recusa = await api(`/vagas-publicas/${vagaId}/candidaturas`, { method: 'POST' }, tokenCandidato);
    assert.equal(recusa.status, 409, JSON.stringify(recusa.json));
    assert.equal(recusa.json.codigo, 'INSCRICOES_INDISPONIVEIS');
    token = await entrarEmpresa('dona@acme.com.br', empresaId);
    const depois = await api(`/empresas/${empresaId}/vagas/${vagaId}`, {}, token);
    assert.equal(depois.json.status, 'INSCRICOES_ENCERRADAS');
    const sumiu = await api('/vagas-publicas');
    assert.equal((sumiu.json as unknown as Array<{ id: string }>).some((item) => item.id === vagaId), false);

    const reaberta = await api(
      `/empresas/${empresaId}/vagas/${vagaId}/prorrogar`,
      { method: 'POST', body: JSON.stringify({ prazoInscricoes: DEPOIS }) },
      token,
    );
    assert.equal(reaberta.status, 201);
    assert.equal(reaberta.json.status, 'PUBLICADA');
    const auditoria = await api(`/empresas/${empresaId}/auditoria`, {}, token);
    assert.equal(auditoria.status, 200);
    assert.equal((auditoria.json as unknown as Array<{ acao: string }>).some((item) => item.acao === 'VAGA_PRORROGADA'), true);

    const pausada = await api(`/empresas/${empresaId}/vagas/${vagaId}/pausar`, { method: 'POST' }, token);
    assert.equal(pausada.status, 201);
    assert.equal(pausada.json.status, 'PAUSADA');
    assert.equal(pausada.json.prazoInscricoes, reaberta.json.prazoInscricoes);
    assert.equal((pausada.json.eventos as Array<{ tipo: string; efeitos: string[] }>).some((item) => item.tipo === 'VagaPausada' && item.efeitos.includes('EM_ESPERA')), true);
    const fora = await api('/vagas-publicas');
    assert.equal((fora.json as unknown as Array<{ id: string }>).some((item) => item.id === vagaId), false);

    const retomada = await api(`/empresas/${empresaId}/vagas/${vagaId}/retomar`, { method: 'POST' }, token);
    assert.equal(retomada.status, 201);
    assert.equal(retomada.json.status, 'PUBLICADA');

    await api(`/empresas/${empresaId}/vagas/${vagaId}/pausar`, { method: 'POST' }, token);
    relogioTeste.definir(new Date('2026-12-22T03:00:00.000Z'));
    const alerta = await api('/interno/vagas/reconciliar', { method: 'POST', headers: { 'x-internal-token': 'job-teste' } });
    token = await entrarEmpresa('dona@acme.com.br', empresaId);
    assert.equal(alerta.status, 201);
    assert.equal(Number(alerta.json.alertas) >= 1, true);
    const alertada = await api(`/empresas/${empresaId}/vagas/${vagaId}`, {}, token);
    assert.equal(alertada.json.status, 'PAUSADA');
    assert.equal((alertada.json.eventos as Array<{ tipo: string }>).some((item) => item.tipo === 'AlertaPausaLonga'), true);

    const semMotivo = await api(`/empresas/${empresaId}/vagas/${vagaId}/fechar`, { method: 'POST', body: JSON.stringify({}) }, token);
    assert.equal(semMotivo.status, 400);
    const fechada = await api(
      `/empresas/${empresaId}/vagas/${vagaId}/fechar`,
      { method: 'POST', body: JSON.stringify({ motivo: 'vaga encerrada pela empresa' }) },
      token,
    );
    assert.equal(fechada.status, 201);
    assert.equal(fechada.json.status, 'FECHADA');
    const reabrir = await api(
      `/empresas/${empresaId}/vagas/${vagaId}/prorrogar`,
      { method: 'POST', body: JSON.stringify({ prazoInscricoes: '2027-01-10T23:59' }) },
      token,
    );
    assert.equal(reabrir.status, 409);
    assert.equal(reabrir.json.codigo, 'VAGA_FECHADA');
    const copia = await api(`/empresas/${empresaId}/vagas/${vagaId}/duplicar`, { method: 'POST' }, token);
    assert.equal(copia.status, 201);
    assert.equal(copia.json.status, 'RASCUNHO');
    assert.notEqual(copia.json.id, vagaId);
  });

  it('empresa pendente não publica e outra empresa não lê a vaga', async () => {
    const dona = await registrar('pendente@acme.com.br');
    const criada = await api(
      '/empresas/cadastro',
      {
        method: 'POST',
        body: JSON.stringify({
          razaoSocial: 'Acme Ltda',
          nomeFantasia: 'Acme',
          cnpj: '11.222.333/0001-81',
          dominio: 'acme.com.br',
          responsavelNome: 'Ana',
          responsavelEmail: 'ana-pendente@acme.com.br',
        }),
      },
      dona,
    );
    const empresaId = String((criada.json.empresa as { id: string }).id);
    const token = String((criada.json.sessao as { accessToken: string }).accessToken);
    const vaga = await api(
      `/empresas/${empresaId}/vagas`,
      {
        method: 'POST',
        body: JSON.stringify({
          titulo: 'Analista de dados',
          descricao: 'Analisar indicadores de produto e escrever consultas.',
          senioridade: 'PLENO',
          modelo: 'HIBRIDO',
          prazoInscricoes: PRAZO,
        }),
      },
      token,
    );
    assert.equal(vaga.status, 201);
    const outra = await empresaVerificada('outra@beta.com.br', cnpj('223334440001'));
    const cruzado = await api(`/empresas/${empresaId}/vagas/${String(vaga.json.id)}`, {}, outra.token);
    assert.equal(cruzado.status, 403);
  });
});
