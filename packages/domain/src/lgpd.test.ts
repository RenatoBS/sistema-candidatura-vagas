import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { contemRanking, emailAnonimizado } from './lgpd';

describe('LGPD', () => {
  it('detecta campos de ranking no pacote exportado', () => {
    assert.equal(contemRanking({ perfil: { nome: 'Ana' } }), false);
    assert.equal(contemRanking({ habilidades: [{ score: 10 }] }), true);
  });

  it('anonimiza o e-mail sem preservar o endereço original', () => {
    const email = emailAnonimizado('11111111-1111-4111-8111-111111111111');
    assert.match(email, /@anon\.invalid$/);
    assert.equal(email.includes('ana@'), false);
  });
});
