import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { executarVerificacaoCnpj } from './verificar-cnpj';

describe('job verificar-cnpj', () => {
  it('chama o endpoint interno com o token e não acessa a BrasilAPI', async () => {
    let url = '';
    let token = '';
    const fetchImpl: typeof fetch = async (entrada, init) => {
      url = String(entrada);
      token = new Headers(init?.headers).get('x-internal-token') ?? '';
      return Response.json({ statusVerificacao: 'VERIFICADA' });
    };
    const resultado = await executarVerificacaoCnpj('empresa-1', fetchImpl, {
      API_PUBLIC_URL: 'http://api.local',
      INTERNAL_JOB_TOKEN: 'job-teste',
    });
    assert.equal(url, 'http://api.local/api/v1/interno/empresas/empresa-1/verificar-cnpj');
    assert.equal(token, 'job-teste');
    assert.deepEqual(resultado, { statusVerificacao: 'VERIFICADA' });
  });
});