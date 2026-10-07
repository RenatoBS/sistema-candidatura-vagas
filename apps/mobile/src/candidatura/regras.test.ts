import assert from 'node:assert/strict';
import test from 'node:test';
import { dadosPublicosCandidato, filtrarNaoLidas, rotuloStatus } from './regras';

test('formata status sem expor ranking', () => {
  assert.equal(rotuloStatus('EM_TRIAGEM', 'Triagem em andamento'), 'Triagem em andamento');
  const publico = dadosPublicosCandidato({ nome: 'Ana', score: 98, posicao: 1, percentil: 99 });
  assert.deepEqual(publico, { nome: 'Ana' });
});
test('filtra notificações não lidas', () => assert.equal(filtrarNaoLidas([{ lida: false }, { lidoEm: 'x' }, {}]).length, 2));
