import assert from 'node:assert/strict';
import test from 'node:test';
import { conviteDaVaga, dadosPublicosCandidato, filtrarNaoLidas, rotuloStatus } from './regras';

test('formata status sem expor ranking', () => {
  assert.equal(rotuloStatus('EM_TRIAGEM', 'Triagem em andamento'), 'Triagem em andamento');
  const publico = dadosPublicosCandidato({ nome: 'Ana', score: 98, posicao: 1, percentil: 99 });
  assert.deepEqual(publico, { nome: 'Ana' });
});
test('filtra notificações não lidas', () => assert.equal(filtrarNaoLidas([{ lida: false }, { lidoEm: 'x' }, {}]).length, 2));
test('encontra o convite pendente da vaga', () => {
  const convites = [{ id: 'c1', vaga: { id: 'v1' } }, { id: 'c2', vaga: { id: 'v2' } }];
  assert.equal(conviteDaVaga(convites, 'v2')?.id, 'c2');
  assert.equal(conviteDaVaga(convites, 'v3'), null);
});
