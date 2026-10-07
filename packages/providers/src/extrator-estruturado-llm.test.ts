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
    assert.match(pedido?.mensagens[0]?.content ?? '', /extrair-curriculo v2/);
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

describe('resumo do currículo', () => {
  const textoReal = [
    'Maria Souza',
    'maria@exemplo.com',
    'EXPERIÊNCIA',
    'Desenvolvedora | Acme | 2019 - Atual',
    'FORMAÇÃO',
    'Ciência da Computação | UFPE',
    'HABILIDADES',
    'TypeScript, Docker',
  ].join('\n');

  it('mock monta o resumo a partir das seções, sem ficar só com o nome', async () => {
    const dados = await new ExtratorEstruturadoMock().extrair(textoReal, catalogo);
    assert.match(dados.resumo, /^Desenvolvedora em Acme/);
    assert.match(dados.resumo, /Habilidades: TypeScript e Docker\./);
    assert.ok(!dados.resumo.includes('Maria'));
    assert.equal(dados.experiencias[0]?.organizacao, 'Acme');
    assert.equal(dados.formacao[0]?.instituicao, 'UFPE');
  });

  it('mock preserva o resumo explícito do currículo', async () => {
    const dados = await new ExtratorEstruturadoMock().extrair('Resumo: Pessoa que desenha sistemas.\nHabilidade: Docker', catalogo);
    assert.equal(dados.resumo, 'Pessoa que desenha sistemas.');
  });

  it('llm com resumo vazio recebe o resumo composto dos dados extraídos', async () => {
    const llm: LlmProvider = {
      async complete() {
        return {
          texto: JSON.stringify({
            resumo: '',
            experiencias: [{ cargo: 'Arquiteta', organizacao: 'Acme', inicio: '2020', fim: null }],
            formacao: [],
            idiomas: [],
            habilidades: [],
          }),
          modelo: 'fake',
          provedor: 'mock',
        };
      },
    };
    const dados = await new ExtratorEstruturadoLlm(llm).extrair('Uso TypeScript.', catalogo);
    assert.match(dados.resumo, /^Arquiteta em Acme/);
    assert.match(dados.resumo, /TypeScript/);
  });
});
