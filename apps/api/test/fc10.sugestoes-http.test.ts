import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import { api, CNPJ_A, conta, criarEmpresa, criarVagaComProcesso, derrubarApp, filaVagasTeste, interno, limparAmbienteTeste, subirApp } from './ajuda-http';

async function vagaComEtapa(empresaId: string, token: string, numeroPerguntas: number) {
  const { vagaId, etapas } = await criarVagaComProcesso(empresaId, token, [{ tipo: 'ENTREVISTA_VOZ', numeroPerguntas }]);
  return { vagaId, etapaId: String(etapas[0]?.id) };
}

type Sugestao = { id: string; enunciado: string };

describe('FC-10 — sugestões de IA sem duplicatas', () => {
  before(subirApp);
  after(derrubarApp);

  beforeEach(() => {
    limparAmbienteTeste();
  });

  it('um único caminho: sugerir não enfileira job (que duplicaria o lote)', async () => {
    const empresa = await criarEmpresa(await conta('a@pessoal.test'), CNPJ_A, 'Acme');
    const { vagaId, etapaId } = await vagaComEtapa(empresa.empresaId, empresa.token, 5);
    const resposta = await api(
      `/empresas/${empresa.empresaId}/vagas/${vagaId}/etapas/${etapaId}/perguntas/sugestoes`,
      { method: 'POST' },
      empresa.token,
    );
    assert.equal(resposta.status, 201, JSON.stringify(resposta.json));
    assert.equal((resposta.json.sugestoes as Sugestao[]).length, 5);
    assert.deepEqual(filaVagasTeste.sugestoes, []);
  });

  it('chamadas concorrentes de sugerir e do job geram no máximo numeroPerguntas - aprovadas', async () => {
    const empresa = await criarEmpresa(await conta('b@pessoal.test'), CNPJ_A, 'Acme');
    const { vagaId, etapaId } = await vagaComEtapa(empresa.empresaId, empresa.token, 5);
    const url = `/empresas/${empresa.empresaId}/vagas/${vagaId}/etapas/${etapaId}/perguntas`;
    const aprovada = await api(url, { method: 'POST', body: JSON.stringify({ enunciado: 'Conte um projeto de que você se orgulha.' }) }, empresa.token);
    assert.equal(aprovada.status, 201);

    const respostas = await Promise.all([
      api(`${url}/sugestoes`, { method: 'POST' }, empresa.token),
      api(`${url}/sugestoes`, { method: 'POST' }, empresa.token),
      interno(`/interno/etapas/${etapaId}/sugerir`),
    ]);
    for (const resposta of respostas) assert.ok(resposta.status < 300, JSON.stringify(resposta.json));

    const detalhe = await api(`/empresas/${empresa.empresaId}/vagas/${vagaId}`, {}, empresa.token);
    const etapa = (detalhe.json.processo as { etapas: Array<{ sugestoes: Sugestao[]; perguntas: unknown[] }> }).etapas[0];
    assert.equal(etapa?.perguntas.length, 1);
    assert.equal(etapa?.sugestoes.length, 4);
    assert.equal(new Set(etapa?.sugestoes.map((item) => item.enunciado)).size, 4);
  });
});
