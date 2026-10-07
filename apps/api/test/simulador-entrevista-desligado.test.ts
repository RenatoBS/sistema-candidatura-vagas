import 'reflect-metadata';

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

delete process.env.SIMULADOR_ENTREVISTA;

import { api, derrubarApp, subirApp } from './ajuda-http';

describe('simulador desligado', () => {
  before(async () => {
    delete process.env.SIMULADOR_ENTREVISTA;
    await subirApp();
  });

  after(derrubarApp);

  it('não registra a rota de desenvolvimento', async () => {
    const status = await api('/dev/simulador/status');
    assert.equal(status.status, 404);
  });
});
