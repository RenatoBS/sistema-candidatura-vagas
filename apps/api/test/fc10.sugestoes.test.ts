import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { PerguntaSugerida } from '@scv/llm';

import { selecionarSugestoes, similaridadeEnunciados } from '../src/vagas/sugestoes';

const sugestao = (enunciado: string): PerguntaSugerida => ({ enunciado, rubrica: { criterios: ['clareza'] }, tempoLimiteSegundos: 120 });

describe('FC-10 — seleção de sugestões de perguntas', () => {
  it('descarta enunciados quase iguais entre si e às perguntas existentes', () => {
    const escolhidas = selecionarSugestoes(
      [
        sugestao('Conte um desafio técnico que você conduziu como desenvolvedor backend.'),
        sugestao('Conte um desafio técnico que você conduziu como desenvolvedor back-end!'),
        sugestao('Como você mede o resultado do seu trabalho no dia a dia?'),
        sugestao('Descreva um incidente em produção que você investigou.'),
      ],
      ['Descreva um incidente em produção que você investigou e resolveu.'],
      5,
    );
    assert.deepEqual(
      escolhidas.map((item) => item.enunciado),
      [
        'Conte um desafio técnico que você conduziu como desenvolvedor backend.',
        'Como você mede o resultado do seu trabalho no dia a dia?',
      ],
    );
  });

  it('nunca devolve mais sugestões do que as vagas livres da etapa', () => {
    const geradas = ['Fale de arquitetura de serviços', 'Explique testes automatizados', 'Descreva observabilidade em produção'].map(sugestao);
    assert.equal(selecionarSugestoes(geradas, [], 2).length, 2);
    assert.equal(selecionarSugestoes(geradas, [], 0).length, 0);
  });

  it('similaridade ignora acentos, caixa e pontuação', () => {
    assert.equal(similaridadeEnunciados('Descrição do Incidente!', 'descricao do incidente'), 1);
    assert.ok(similaridadeEnunciados('liderança de equipes', 'otimização de consultas SQL') < 0.2);
  });
});
