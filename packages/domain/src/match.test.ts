import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  atendeObrigatorias,
  calcularCompatibilidade,
  matchForte,
  similaridadeCosseno,
  textoEmbeddingCandidato,
  vagaElegivelParaMatch,
  VERSAO_MATCH,
  type HabilidadeExigidaMatch,
} from './match';

const AGORA = new Date('2026-10-06T15:00:00.000Z');
const FUTURO = new Date('2026-11-21T02:59:00.000Z');

const exigidas: HabilidadeExigidaMatch[] = [
  { habilidadeId: 'ts', nome: 'TypeScript', nivelMinimo: 4, peso: 2, obrigatoria: true },
  { habilidadeId: 'pg', nome: 'PostgreSQL', nivelMinimo: 3, peso: 1, obrigatoria: false },
  { habilidadeId: 'k8s', nome: 'Kubernetes', nivelMinimo: 2, peso: 1, obrigatoria: false },
];

describe('match', () => {
  it('só vaga PUBLICADA dentro do prazo é elegível', () => {
    assert.equal(vagaElegivelParaMatch({ status: 'PUBLICADA', prazoInscricoes: FUTURO }, AGORA), true);
    for (const status of ['RASCUNHO', 'PAUSADA', 'INSCRICOES_ENCERRADAS', 'FECHADA'] as const) {
      assert.equal(vagaElegivelParaMatch({ status, prazoInscricoes: FUTURO }, AGORA), false, status);
    }
    assert.equal(vagaElegivelParaMatch({ status: 'PUBLICADA', prazoInscricoes: new Date('2026-10-01T00:00:00Z') }, AGORA), false);
  });

  it('similaridade cosseno trata vetores vazios e de tamanhos diferentes', () => {
    assert.equal(similaridadeCosseno([1, 0], [1, 0]), 1);
    assert.equal(similaridadeCosseno([1, 0], [0, 1]), 0);
    assert.equal(similaridadeCosseno([1, 0], [1, 0, 0]), 0);
    assert.equal(similaridadeCosseno([0, 0], [1, 0]), 0);
  });

  it('exige todas as habilidades obrigatórias no nível mínimo', () => {
    assert.equal(atendeObrigatorias(exigidas, [{ habilidadeId: 'ts', nome: 'TypeScript', nivel: 4 }]), true);
    assert.equal(atendeObrigatorias(exigidas, [{ habilidadeId: 'ts', nome: 'TypeScript', nivel: 3 }]), false);
    assert.equal(atendeObrigatorias(exigidas, [{ habilidadeId: 'pg', nome: 'PostgreSQL', nivel: 5 }]), false);
  });

  it('combina similaridade e cobertura ponderada com explicação', () => {
    const resultado = calcularCompatibilidade({
      similaridade: 0.8,
      exigidas,
      candidato: [
        { habilidadeId: 'ts', nome: 'TypeScript', nivel: 5 },
        { habilidadeId: 'pg', nome: 'PostgreSQL', nivel: 1 },
      ],
    });
    // cobertura = (2 + 1 * 1/3) / 4
    assert.equal(resultado.explicacao.coberturaHabilidades, 0.5833);
    assert.equal(resultado.compatibilidade, 0.7133);
    assert.deepEqual(resultado.explicacao.atendidas, ['TypeScript']);
    assert.deepEqual(resultado.explicacao.abaixoDoNivel, ['PostgreSQL']);
    assert.deepEqual(resultado.explicacao.faltantes, ['Kubernetes']);
    assert.equal(resultado.explicacao.versao, VERSAO_MATCH);
  });

  it('sem habilidades na vaga usa só a similaridade, limitada a [0, 1]', () => {
    assert.equal(calcularCompatibilidade({ similaridade: -0.3, exigidas: [], candidato: [] }).compatibilidade, 0);
    assert.equal(calcularCompatibilidade({ similaridade: 0.91234, exigidas: [], candidato: [] }).compatibilidade, 0.9123);
  });

  it('match forte respeita o limiar', () => {
    assert.equal(matchForte(0.75), true);
    assert.equal(matchForte(0.7499), false);
    assert.equal(matchForte(0.6, 0.5), true);
  });

  it('texto do candidato não leva nome nem contato', () => {
    const texto = textoEmbeddingCandidato({
      perfil: {
        resumo: 'Desenvolvedora backend',
        experiencias: [{ cargo: 'Engenheira de software', organizacao: 'X' }],
        formacao: [{ curso: 'Ciência da Computação' }],
        email: 'alguem@exemplo.test',
      },
      habilidades: [{ nome: 'TypeScript', nivel: 4 }],
    });
    assert.match(texto, /Engenheira de software/);
    assert.match(texto, /TypeScript/);
    assert.doesNotMatch(texto, /exemplo\.test/);
  });
});
