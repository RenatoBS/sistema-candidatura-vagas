import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { BrasilApiFonteCnpj, USER_AGENT_CNPJ } from './cnpj';

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
    const fonte = new BrasilApiFonteCnpj(fetchImpl, { atrasoBaseMs: 0 });
    const resultado = await fonte.consultar('11222333000181');
    assert.equal(resultado.indisponivel, true);
  });

  it('envia User-Agent identificável e Accept: application/json', async () => {
    let cabecalhos = new Headers();
    const fetchImpl: typeof fetch = async (_entrada, init) => {
      cabecalhos = new Headers(init?.headers);
      return Response.json({ razao_social: 'ACME LTDA', descricao_situacao_cadastral: 'ATIVA' });
    };
    await new BrasilApiFonteCnpj(fetchImpl).consultar('11222333000181');
    assert.equal(cabecalhos.get('accept'), 'application/json');
    assert.equal(cabecalhos.get('user-agent'), USER_AGENT_CNPJ);
    assert.match(cabecalhos.get('user-agent') ?? '', /sistema-candidatura-vagas/);
  });

  it('404 é CNPJ inexistente e não gasta retry', async () => {
    let chamadas = 0;
    const fetchImpl: typeof fetch = async () => {
      chamadas += 1;
      return new Response('{}', { status: 404 });
    };
    const resultado = await new BrasilApiFonteCnpj(fetchImpl, { atrasoBaseMs: 0 }).consultar('11222333000181');
    assert.deepEqual(resultado, { situacaoAtiva: false, razaoSocial: '', indisponivel: false });
    assert.equal(chamadas, 1);
  });

  for (const status of [403, 429]) {
    it(`${status} é indisponível, com retry; sucesso numa nova tentativa vence`, async () => {
      const esperas: number[] = [];
      const respostas = [new Response('{}', { status }), Response.json({ razao_social: 'ACME', descricao_situacao_cadastral: 'ATIVA' })];
      const fetchImpl: typeof fetch = async () => respostas.shift() ?? new Response('{}', { status });
      const fonte = new BrasilApiFonteCnpj(fetchImpl, { esperar: async (ms) => void esperas.push(ms) });
      const ok = await fonte.consultar('11222333000181');
      assert.equal(ok.indisponivel, false);
      assert.equal(ok.situacaoAtiva, true);
      assert.deepEqual(esperas, [500]);
    });

    it(`${status} persistente esgota as tentativas e marca indisponível`, async () => {
      let chamadas = 0;
      const fetchImpl: typeof fetch = async () => {
        chamadas += 1;
        return new Response('{}', { status });
      };
      const resultado = await new BrasilApiFonteCnpj(fetchImpl, { atrasoBaseMs: 0 }).consultar('11222333000181');
      assert.equal(resultado.indisponivel, true);
      assert.equal(chamadas, 3);
    });
  }
});
