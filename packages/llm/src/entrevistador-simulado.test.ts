import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { LlmEntrevistadorSimulado, pontuar } from './entrevistador-simulado';
import { criarLlmProvider } from './fabrica';
import { LlmMock } from './mock';
import { simuladorEntrevistaLigado } from './simulador-flag';
import { sugerirPerguntas } from './sugerir';

const originalFetch = globalThis.fetch;

describe('entrevistador simulado', () => {
  it('não usa rede e repete a mesma sugestão', async () => {
    globalThis.fetch = (() => {
      throw new Error('rede');
    }) as typeof fetch;
    try {
      const llm = new LlmEntrevistadorSimulado();
      const entrada = {
        titulo: 'Desenvolvedor Full Stack',
        descricao: 'Produto interno',
        senioridade: 'PLENO',
        modelo: 'REMOTO',
        habilidades: ['TypeScript'],
        existentes: [],
        faltantes: 3,
        tipoEtapa: 'TRIAGEM_WHATSAPP',
      };
      const primeira = await sugerirPerguntas(llm, entrada);
      const segunda = await sugerirPerguntas(llm, entrada);
      assert.deepEqual(primeira, segunda);
      assert.equal(primeira.perguntas.length, 3);
      assert.match(primeira.perguntas[0]?.enunciado ?? '', /Desenvolvedor Full Stack/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('reage ao texto: resposta curta pontua menos que um exemplo com resultado', async () => {
    const llm = new LlmEntrevistadorSimulado();
    const curta = await llm.complete({
      mensagens: [{ role: 'user', content: prompt('Fiz a tarefa.') }],
      json: true,
    });
    const longa = await llm.complete({
      mensagens: [
        {
          role: 'user',
          content: prompt(
            'No último trimestre priorizei um incidente com a equipe, isolei a causa e o tempo de resposta caiu de 4 segundos para 200 milissegundos. Documentei o resultado.',
          ),
        },
      ],
      json: true,
    });
    const notaCurta = JSON.parse(curta.texto) as { nota: number; justificativa: string };
    const notaLonga = JSON.parse(longa.texto) as { nota: number; justificativa: string };
    assert.ok(notaCurta.nota < notaLonga.nota);
    assert.match(notaCurta.justificativa, /Fiz a tarefa/);
    assert.match(notaLonga.justificativa, /200 milissegundos/);
    assert.equal(curta.modelo, 'entrevistador-simulado');
    assert.equal(curta.provedor, 'mock');
    assert.equal(pontuar('Fiz a tarefa.'), notaCurta.nota);
  });

  it('a flag escolhe o entrevistador e recusa produção, mesmo com provedor openai', () => {
    assert.equal(simuladorEntrevistaLigado({}), false);
    assert.ok(criarLlmProvider({ LLM_PROVIDER: 'mock' }) instanceof LlmMock);
    const simulado = criarLlmProvider({
      NODE_ENV: 'development',
      SIMULADOR_ENTREVISTA: 'true',
      LLM_PROVIDER: 'openai',
      OPENAI_API_KEY: 'sk-nao-usar',
    });
    assert.ok(simulado instanceof LlmEntrevistadorSimulado);
    assert.throws(
      () => criarLlmProvider({ NODE_ENV: 'production', SIMULADOR_ENTREVISTA: 'true', LLM_PROVIDER: 'openai' }),
      /produção/,
    );
  });
});

function prompt(resposta: string): string {
  return ['tarefa: avaliar_triagem', 'enunciado: Conte um exemplo', '<resposta_candidato>', resposta, '</resposta_candidato>'].join(
    '\n',
  );
}
