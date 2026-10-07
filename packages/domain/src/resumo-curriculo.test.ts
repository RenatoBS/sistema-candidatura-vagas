import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  anosDeExperiencia,
  comporResumoCurriculo,
  extrairEstruturaCurriculo,
  resumoDeTextoLivre,
  separarSecoesCurriculo,
} from './resumo-curriculo';

const CV = `Maria Souza
maria@exemplo.com | (81) 99999-0000
linkedin.com/in/maria

RESUMO PROFISSIONAL
Engenheira de software com foco em APIs e dados.
Gosta de times pequenos e entregas frequentes.

EXPERIÊNCIA PROFISSIONAL
Desenvolvedora Sênior | Acme Tecnologia | jan/2021 - Atual
- Liderou a migração para microsserviços
Desenvolvedora Pleno - Beta Sistemas (2018 - 2020)
Analista
Gama Ltda
2016 – 2018

FORMAÇÃO ACADÊMICA
Ciência da Computação | Universidade Federal de Pernambuco | 2012 - 2016

Idiomas
Português (nativo), Inglês - avançado

Competências: TypeScript, Node.js; PostgreSQL • Docker`;

describe('leitura de currículo por seções', () => {
  it('separa cabeçalho e seções, inclusive com conteúdo na mesma linha do título', () => {
    const { cabecalho, secoes } = separarSecoesCurriculo(CV);
    assert.equal(cabecalho[0], 'Maria Souza');
    assert.equal(secoes.resumo.length, 2);
    assert.equal(secoes.idiomas.length, 1);
    assert.deepEqual(separarSecoesCurriculo('Resumo: pessoa desenvolvedora').secoes.resumo, ['pessoa desenvolvedora']);
  });

  it('extrai resumo, experiências, formação, idiomas e habilidades', () => {
    const dados = extrairEstruturaCurriculo(CV);
    assert.match(dados.resumo, /^Engenheira de software com foco em APIs e dados\./);
    assert.deepEqual(dados.experiencias, [
      { cargo: 'Desenvolvedora Sênior', organizacao: 'Acme Tecnologia', inicio: 'jan/2021', fim: null },
      { cargo: 'Desenvolvedora Pleno', organizacao: 'Beta Sistemas', inicio: '2018', fim: '2020' },
      { cargo: 'Analista', organizacao: 'Gama Ltda', inicio: '2016', fim: '2018' },
    ]);
    assert.deepEqual(dados.formacao, [
      { curso: 'Ciência da Computação', instituicao: 'Universidade Federal de Pernambuco' },
    ]);
    assert.deepEqual(dados.idiomas, ['Português (nativo)', 'Inglês - avançado']);
    assert.deepEqual(
      dados.habilidades.map((item) => item.nome),
      ['TypeScript', 'Node.js', 'PostgreSQL', 'Docker'],
    );
  });

  it('texto sem seções não inventa estrutura', () => {
    const dados = extrairEstruturaCurriculo('Joao Silva\nDesenvolvedor');
    assert.equal(dados.resumo, '');
    assert.deepEqual(dados.experiencias, []);
    assert.deepEqual(dados.habilidades, []);
  });
});

describe('resumo do currículo', () => {
  const agora = new Date('2026-10-07T00:00:00Z');

  it('calcula anos de experiência com fim em aberto até o ano atual', () => {
    const dados = extrairEstruturaCurriculo(CV);
    assert.equal(anosDeExperiencia(dados.experiencias, agora), 10);
    assert.equal(anosDeExperiencia([], agora), null);
  });

  it('compõe o resumo com cargo atual, tempo, formação, habilidades e idiomas', () => {
    const resumo = comporResumoCurriculo(extrairEstruturaCurriculo(CV), agora);
    assert.match(resumo, /^Desenvolvedora Sênior em Acme Tecnologia, com cerca de 10 anos de experiência\./);
    assert.match(resumo, /Passagens anteriores: Beta Sistemas e Gama Ltda\./);
    assert.match(resumo, /Formação: Ciência da Computação \(Universidade Federal de Pernambuco\)\./);
    assert.match(resumo, /Habilidades: TypeScript, Node\.js, PostgreSQL e Docker\./);
    assert.match(resumo, /Idiomas: Português \(nativo\) e Inglês - avançado\./);
    assert.ok(resumo.length <= 600);
  });

  it('devolve vazio quando não há dados e nunca usa só o nome', () => {
    assert.equal(comporResumoCurriculo({ experiencias: [], formacao: [], idiomas: [], habilidades: [] }), '');
    assert.equal(resumoDeTextoLivre('Maria Souza\nmaria@exemplo.com\n(81) 99999-0000'), '');
  });

  it('texto livre pula nome e contatos e usa o primeiro parágrafo corrido', () => {
    const texto = 'Maria Souza\nmaria@exemplo.com\nEngenheira de software com dez anos de experiência em APIs e dados.';
    assert.equal(resumoDeTextoLivre(texto), 'Engenheira de software com dez anos de experiência em APIs e dados.');
  });
});
