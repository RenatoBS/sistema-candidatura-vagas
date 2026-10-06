import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { HealthController } from '../src/health/health.controller';

describe('HealthController', () => {
  it('retorna status ok', () => {
    const controller = new HealthController();
    const result = controller.check();

    assert.equal(result.status, 'ok');
    assert.ok(result.timestamp);
  });
});
