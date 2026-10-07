import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DOMAIN_PACKAGE_VERSION } from './index';

describe('domain', () => {
  it('exporta a versão do pacote', () => {
    assert.equal(DOMAIN_PACKAGE_VERSION, '0.5.0');
  });
});
