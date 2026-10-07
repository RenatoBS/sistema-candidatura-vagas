import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import { erroPerguntasIncompletasSchema } from '@scv/contracts';

import { api, CNPJ_A, conta, criarVagaComProcesso, derrubarApp, empresaVerificada, limparAmbienteTeste, subirApp } from './ajuda-http';

describe('FC-07 — publicar vaga com todas as etapas', () => {
  before(subirApp);
  after(derrubarApp);
  beforeEach(limparAmbienteTeste);

  it('o 409 informa a etapa pendente e quantas perguntas faltam; publica quando as duas estão completas', async () => {
    const empresa = await empresaVerificada(await conta('fc07@pessoal.test'), CNPJ_A, 'Acme');
    const { vagaId, etapas } = await criarVagaComProcesso(empresa.empresaId, empresa.token, [
      { tipo: 'TRIAGEM_WHATSAPP', numeroPerguntas: 2 },
      { tipo: 'ENTREVISTA_VOZ', numeroPerguntas: 2 },
    ]);
    const [triagem, voz] = etapas;
    assert.ok(triagem && voz);
    const urlPerguntas = (etapaId: string) => `/empresas/${empresa.empresaId}/vagas/${vagaId}/etapas/${etapaId}/perguntas`;
    const publicar = () => api(`/empresas/${empresa.empresaId}/vagas/${vagaId}/publicar`, { method: 'POST' }, empresa.token);

    // Etapa 1 completa (2 aprovadas); etapa 2 com 1 aprovada e 1 sugestão pendente.
    for (const enunciado of ['Conte um projeto recente em que você liderou.', 'Como você prioriza tarefas urgentes?']) {
      assert.equal((await api(urlPerguntas(triagem.id), { method: 'POST', body: JSON.stringify({ enunciado }) }, empresa.token)).status, 201);
    }
    assert.equal(
      (await api(urlPerguntas(voz.id), { method: 'POST', body: JSON.stringify({ enunciado: 'Explique uma decisão de arquitetura sua.' }) }, empresa.token)).status,
      201,
    );
    const sugeridas = await api(`${urlPerguntas(voz.id)}/sugestoes`, { method: 'POST' }, empresa.token);
    assert.equal(sugeridas.status, 201, JSON.stringify(sugeridas.json));
    const pendentes = sugeridas.json.sugestoes as Array<{ id: string }>;
    assert.equal(pendentes.length, 1);

    const bloqueada = await publicar();
    assert.equal(bloqueada.status, 409);
    const corpo = erroPerguntasIncompletasSchema.parse(bloqueada.json);
    assert.deepEqual(
      corpo.detalhes.etapas.map((etapa) => ({ ordem: etapa.ordem, tipo: etapa.tipo, faltam: etapa.faltam, pendentes: etapa.pendentes })),
      [{ ordem: 2, tipo: 'ENTREVISTA_VOZ', faltam: 1, pendentes: 1 }],
    );
    assert.match(corpo.mensagem, /etapa 2 \(entrevista por voz\)/);
    assert.match(corpo.mensagem, /1 sugestão pendente/);
    assert.doesNotMatch(corpo.mensagem, /etapa 1/);

    const aceita = await api(`/empresas/${empresa.empresaId}/perguntas/${String(pendentes[0]?.id)}/aceitar`, { method: 'POST', body: JSON.stringify({}) }, empresa.token);
    assert.equal(aceita.status, 201, JSON.stringify(aceita.json));
    const publicada = await publicar();
    assert.equal(publicada.status, 201, JSON.stringify(publicada.json));
    assert.equal(publicada.json.status, 'PUBLICADA');
  });
});
