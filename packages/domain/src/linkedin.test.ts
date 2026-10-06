import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { interpretarLinkedinUrl } from './linkedin';

describe('linkedinUrl', () => {
  it('aceita perfil público e normaliza a barra final', () => {
    const lido = interpretarLinkedinUrl('https://www.linkedin.com/in/maria-souza/');
    assert.deepEqual(lido, { ok: true, url: 'https://www.linkedin.com/in/maria-souza' });
  });

  it('rejeita URL inválida sem consultar a rede', async () => {
    const original = globalThis.fetch;
    let chamadas = 0;
    globalThis.fetch = (async () => {
      chamadas += 1;
      throw new Error('não deveria chamar a rede');
    }) as typeof fetch;
    try {
      assert.deepEqual(interpretarLinkedinUrl('https://www.linkedin.com/company/acme'), {
        ok: false,
        codigo: 'LINKEDIN_INVALIDO',
      });
      assert.deepEqual(interpretarLinkedinUrl('http://linkedin.com/in/ana'), {
        ok: false,
        codigo: 'LINKEDIN_INVALIDO',
      });
      assert.equal(chamadas, 0);
    } finally {
      globalThis.fetch = original;
    }
  });

  it('trata vazio como ausência de link', () => {
    assert.deepEqual(interpretarLinkedinUrl('  '), { ok: true, url: null });
    assert.deepEqual(interpretarLinkedinUrl(null), { ok: true, url: null });
  });
});
