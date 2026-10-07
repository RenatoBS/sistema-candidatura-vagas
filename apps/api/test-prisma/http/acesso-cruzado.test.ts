import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import {
  api,
  appEmExecucao,
  conta,
  derrubarApp,
  SENHA,
  subirAppPostgres,
} from './ajuda-pg';
import { rotasRegistradas, type RotaRegistrada } from './rotas';
import { montarCenario, type Cenario } from './seed-cenario';

type Resultado = { rota: string; status: number };

const CORPO: Record<string, string | undefined> = { POST: '{}', PUT: '{}', PATCH: '{}' };
const BLOQUEADO = new Set([400, 403, 404]);

function ehRotaDeTenant(caminho: string): boolean {
  if (caminho.startsWith('interno/')) return false; // protegidas por token interno, não por sessão de usuário
  return caminho.includes(':empresaId') || /^vagas\/:vagaId/.test(caminho);
}

function ehRotaAdmin(caminho: string): boolean {
  return caminho.startsWith('admin/');
}

function ehRotaDeCandidato(caminho: string): boolean {
  return (
    /^candidatos\/me\/(candidaturas|convites)\/:id/.test(caminho) ||
    /^curriculos\/:id/.test(caminho) ||
    /^notificacoes\/:id\//.test(caminho) ||
    /^voz\/(entrevistas|sessoes)\//.test(caminho)
  );
}

/** Token de reautenticação do atacante: rotas @Sensivel exigem o header antes de qualquer checagem de tenant. */
async function reautenticar(token: string): Promise<string> {
  const resposta = await api('/auth/reautenticar', { method: 'POST', body: JSON.stringify({ senha: SENHA }) }, token);
  assert.equal(resposta.status, 201, JSON.stringify(resposta.json));
  return String(resposta.json.reauthToken);
}

async function chamar(
  rota: RotaRegistrada,
  ids: Record<string, string>,
  caminhoComIdDe: (nome: string) => string,
  token: string,
  reauth?: string,
): Promise<Resultado> {
  const caminho = '/' + rota.caminho.replace(/:([A-Za-z]+)/g, (_, nome: string) => ids[nome] ?? caminhoComIdDe(nome));
  const headers = reauth ? { 'x-reauth-token': reauth } : undefined;
  const resposta = await api(caminho, { method: rota.metodo, body: CORPO[rota.metodo], headers }, token);
  return { rota: `${rota.metodo} ${rota.caminho}`, status: resposta.status };
}

describe('acesso cruzado contra Postgres, conectado como scv_app (FC-03)', () => {
  let cenario: Cenario;
  let rotas: RotaRegistrada[];

  before(async () => {
    await subirAppPostgres();
    cenario = await montarCenario();
    rotas = rotasRegistradas(appEmExecucao()).filter((rota) => !rota.caminho.startsWith('{') && !rota.caminho.includes('$'));
  });
  after(derrubarApp);

  const idsDeA = () => ({
    empresaId: cenario.a.empresaId,
    vagaId: cenario.a.vagaId,
    etapaId: cenario.a.etapaId,
    perguntaId: cenario.a.perguntaId,
    membroId: cenario.a.membroId,
    entrevistaId: cenario.a.entrevistaId,
    respostaId: cenario.a.respostaId,
    candidaturaId: cenario.a.candidaturaId,
    candidatoId: cenario.a.candidatoId,
  });

  it('as rotas de tenant e de admin foram descobertas (a suíte não passa por estar vazia)', () => {
    const tenant = rotas.filter((rota) => ehRotaDeTenant(rota.caminho));
    const admin = rotas.filter((rota) => ehRotaAdmin(rota.caminho));
    assert.ok(tenant.length >= 50, `rotas de tenant: ${tenant.length}`);
    assert.ok(admin.length >= 8, `rotas admin: ${admin.length}`);
  });

  it('membro da empresa B recebe 400/403/404 (nunca 2xx/5xx) em TODA rota de tenant apontando para recursos da empresa A', async () => {
    const violacoes: Resultado[] = [];
    let total = 0;
    const reauth = await reautenticar(cenario.b.token);
    for (const rota of rotas.filter((item) => ehRotaDeTenant(item.caminho))) {
      const resultado = await chamar(rota, idsDeA(), () => randomUUID(), cenario.b.token, reauth);
      total += 1;
      if (!BLOQUEADO.has(resultado.status)) violacoes.push(resultado);
    }
    console.log(`  (${total} rotas de tenant testadas como empresa B)`);
    assert.deepEqual(violacoes, []);
  });

  it('o mesmo ataque, só que com os dois conjuntos de ids de outra empresa trocados (B → A inverso)', async () => {
    const violacoes: Resultado[] = [];
    const idsDeB = {
      empresaId: cenario.b.empresaId,
      vagaId: cenario.b.vagaId,
      etapaId: cenario.b.etapaId,
      perguntaId: cenario.b.perguntaId,
      membroId: cenario.b.membroId,
      entrevistaId: cenario.b.entrevistaId,
      respostaId: cenario.b.respostaId,
      candidaturaId: cenario.b.candidaturaId,
      candidatoId: cenario.b.candidatoId,
    };
    const reauth = await reautenticar(cenario.a.token);
    for (const rota of rotas.filter((item) => ehRotaDeTenant(item.caminho))) {
      const resultado = await chamar(rota, idsDeB, () => randomUUID(), cenario.a.token, reauth);
      if (!BLOQUEADO.has(resultado.status)) violacoes.push(resultado);
    }
    assert.deepEqual(violacoes, []);
  });

  it('candidato recebe 400/403/404 nas rotas de tenant', async () => {
    const violacoes: Resultado[] = [];
    const reauth = await reautenticar(cenario.candidatoToken);
    for (const rota of rotas.filter((item) => ehRotaDeTenant(item.caminho))) {
      const resultado = await chamar(rota, idsDeA(), () => randomUUID(), cenario.candidatoToken, reauth);
      if (!BLOQUEADO.has(resultado.status)) violacoes.push(resultado);
    }
    assert.deepEqual(violacoes, []);
  });

  it('membro de empresa recebe 403 em TODAS as rotas admin/*', async () => {
    const violacoes: Resultado[] = [];
    const reauth = await reautenticar(cenario.b.token);
    for (const rota of rotas.filter((item) => ehRotaAdmin(item.caminho))) {
      const resultado = await chamar(rota, idsDeA(), () => randomUUID(), cenario.b.token, reauth);
      if (resultado.status !== 403 && resultado.status !== 400) violacoes.push(resultado);
    }
    assert.deepEqual(violacoes, []);
  });

  it('outro candidato recebe 400/403/404 ao tocar candidaturas, convites, CVs, notificações e voz de um candidato da empresa A', async () => {
    const outro = await conta('outro-candidato@pessoal.test');
    const onboard = await api('/onboarding/candidato', { method: 'POST', body: JSON.stringify({ nome: 'Outro' }) }, outro);
    const token = String(onboard.json.accessToken);
    const reauth = await reautenticar(token);
    const violacoes: Resultado[] = [];
    let total = 0;
    for (const rota of rotas.filter((item) => ehRotaDeCandidato(item.caminho))) {
      const idsDoAlvo = {
        id: /^curriculos/.test(rota.caminho) ? cenario.a.curriculoId : /^notificacoes/.test(rota.caminho) ? cenario.a.notificacaoId : cenario.a.candidaturaId,
        entrevistaId: cenario.a.entrevistaId,
        candidaturaId: cenario.a.candidaturaId,
      };
      const resultado = await chamar(rota, idsDoAlvo, () => randomUUID(), token, reauth);
      total += 1;
      if (!BLOQUEADO.has(resultado.status)) violacoes.push(resultado);
    }
    console.log(`  (${total} rotas de candidato testadas)`);
    assert.deepEqual(violacoes, []);
  });

  it('controle positivo: a própria empresa A lê os próprios recursos (a suíte distingue bloqueio de falha)', async () => {
    const a = cenario.a;
    const rotasLeitura = [
      `/empresas/${a.empresaId}`,
      `/empresas/${a.empresaId}/vagas`,
      `/empresas/${a.empresaId}/vagas/${a.vagaId}`,
      `/empresas/${a.empresaId}/membros`,
      `/empresas/${a.empresaId}/perguntas`,
      `/empresas/${a.empresaId}/triagens/${a.entrevistaId}`,
      `/vagas/${a.vagaId}/candidaturas`,
      `/empresas/${a.empresaId}/vagas/${a.vagaId}/ranking`,
    ];
    for (const caminho of rotasLeitura) {
      const resposta = await api(caminho, {}, a.token);
      assert.equal(resposta.status, 200, `${caminho} → ${resposta.status} ${JSON.stringify(resposta.json)}`);
    }
  });
});
