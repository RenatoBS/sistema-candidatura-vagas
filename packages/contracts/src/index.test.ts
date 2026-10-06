import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { API_VERSION } from './index.js';

describe('contracts', () => {
  it('define a versão da API', () => {
    assert.equal(API_VERSION, 'v1');
  });
});
