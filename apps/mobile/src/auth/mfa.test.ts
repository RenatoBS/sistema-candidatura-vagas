import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { segredoDaUri, segredoEmGrupos } from './mfa';

describe('configuração manual do MFA', () => {
  it('extrai o segredo da URI otpauth', () => {
    const uri = 'otpauth://totp/SCV:ana%40acme.com?secret=JBSWY3DPEHPK3PXP&issuer=SCV&digits=6&period=30';
    assert.equal(segredoDaUri(uri), 'JBSWY3DPEHPK3PXP');
    assert.equal(segredoDaUri('otpauth://totp/SCV:ana'), null);
  });

  it('agrupa o segredo de 4 em 4', () => {
    assert.equal(segredoEmGrupos('JBSWY3DPEHPK3PXPAB'), 'JBSW Y3DP EHPK 3PXP AB');
  });
});
