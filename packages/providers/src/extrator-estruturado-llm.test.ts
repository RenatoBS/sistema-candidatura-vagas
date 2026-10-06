import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { schemaDadosCurriculo } from '@scv/domain';
import type { LlmProvider, PedidoLlm } from '@scv/llm';

import { ExtratorEstruturadoMock } from './extrator-estruturado';
import { criarExtratorEstruturado, ExtratorEstruturadoLlm } from './extrator-estruturado-llm';

const catalogo = [{ id: '1', nome: 'TypeScript', categoria: 'linguagem', sinonimos: ['TS'] }];

describe('ExtratorEstruturadoLlm', () => {
  it('envia o JSON Schema e aceita a resposta válida', async () => {
    let pedido: PedidoLlm | undefined;
    const llm: LlmProvider = {
      async complete(entrada) {
        pedido = entrada;
        return {
          texto: JSON.stringify({
            resumo: 'Pessoa que desenha sistemas.',
            experiencias: [{ cargo: 'Arquiteta', organizacao: 'Acme', inicio: '2020', fim: null }],
            formacao: [],
            idiomas: ['português'],
            habilidades: [{ nome: 'TypeScript', nivel: 4 }],
          }),
          modelo: 'fake',
          provedor: 'mock',
        };
      },
    };
    const dados = await new ExtratorEstruturadoLlm(llm).extrair('Uso TypeScript no dia a dia.', catalogo);
    assert.equal(pedido?.json, true);
    assert.equal(pedido?.schema, schemaDadosCurriculo);
    assert.match(pedido?.mensagens[0]?.content ?? '', /extrair-curriculo v1/);
    assert.equal(dados.resumo, 'Pessoa que desenha sistemas.');
    assert.equal(dados.experiencias[0]?.cargo, 'Arquiteta');
    assert.equal(dados.habilidades[0]?.nivel, 4);
  });

  it('rejeita JSON que não obedece o schema', async () => {
    const llm: LlmProvider = {
      async complete() {
        return { texto: '{"resumo": 1}', modelo: 'fake', provedor: 'mock' };
      },
    };
    await assert.rejects(() => new ExtratorEstruturadoLlm(llm).extrair('texto', catalogo), /inválida/);
  });

  it('mock continua padrão e llm só entra por env', () => {
    assert.ok(criarExtratorEstruturado({}) instanceof ExtratorEstruturadoMock);
    assert.ok(criarExtratorEstruturado({ EXTRATOR_CURRICULO: 'mock', LLM_PROVIDER: 'openai' }) instanceof ExtratorEstruturadoMock);
    assert.ok(criarExtratorEstruturado({ EXTRATOR_CURRICULO: 'llm' }) instanceof ExtratorEstruturadoLlm);
  });
});
