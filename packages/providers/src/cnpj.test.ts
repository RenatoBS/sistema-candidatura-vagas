import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { BrasilApiFonteCnpj } from './cnpj';

describe('BrasilAPI CNPJ', () => {
  it('interpreta situação ativa sem chamar a rede', async () => {
    const fetchImpl: typeof fetch = async (entrada) => {
      assert.equal(String(entrada), 'https://brasilapi.com.br/api/cnpj/v1/11222333000181');
      return new Response(
        JSON.stringify({
          razao_social: 'ACME LTDA',
          descricao_situacao_cadastral: 'ATIVA',
        }),
        { status: 200 },
      );
    };
    const fonte = new BrasilApiFonteCnpj(fetchImpl);
    const resultado = await fonte.consultar('11222333000181');
    assert.equal(resultado.situacaoAtiva, true);
    assert.equal(resultado.razaoSocial, 'ACME LTDA');
    assert.equal(resultado.indisponivel, false);
  });

  it('marca fonte indisponível quando o HTTP falha', async () => {
    const fetchImpl: typeof fetch = async () => new Response('erro', { status: 503 });
    const fonte = new BrasilApiFonteCnpj(fetchImpl);
    const resultado = await fonte.consultar('11222333000181');
    assert.equal(resultado.indisponivel, true);
  });
});
