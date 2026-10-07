import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  avaliarAviso,
  avaliarReconexao,
  concederExcecao,
  decidirAdmissao,
  decidirTurno,
  pausarTimer,
  percentil50,
  retomarTimer,
  tempoRestanteSegundos,
  type EstadoVoz,
  type PerguntaRoteiro,
} from './voz';

const INICIO = '2026-10-07T15:00:00.000Z';

function estado(patch: Partial<EstadoVoz> = {}): EstadoVoz {
  return {
    indice: 0,
    inicioPerguntaEm: INICIO,
    pausadoMs: 0,
    pausadoEm: null,
    followUpUsado: false,
    avisoEnviado: false,
    rascunho: null,
    ...patch,
  };
}

const PERGUNTAS: PerguntaRoteiro[] = [
  { ordem: 1, enunciado: 'Pergunta 1', tempoLimiteSegundos: 30 },
  { ordem: 2, enunciado: 'Pergunta 2', tempoLimiteSegundos: 30 },
];

describe('voz', () => {
  it('pergunta na ordem e só faz follow-up dentro do tempo', () => {
    const curto = decidirTurno({
      perguntas: PERGUNTAS,
      estado: estado(),
      agora: new Date(INICIO),
      texto: 'sim',
    });
    assert.equal(curto.acao, 'followup');
    if (curto.acao !== 'followup') return;
    assert.match(curto.enunciado, /detalhar/);
    assert.doesNotMatch(curto.enunciado, /idade|gênero|religião/i);

    const longo = decidirTurno({
      perguntas: PERGUNTAS,
      estado: curto.estado,
      agora: new Date(INICIO),
      texto: 'Tenho cinco anos de experiência prática nesta função e resultados objetivos.',
    });
    assert.equal(longo.acao, 'avancar');
    if (longo.acao !== 'avancar') return;
    assert.equal(longo.proxima?.enunciado, 'Pergunta 2');
    assert.equal(longo.estado.indice, 1);
  });

  it('não aprofunda atributo protegido', () => {
    const decisao = decidirTurno({
      perguntas: PERGUNTAS,
      estado: estado(),
      agora: new Date(INICIO),
      texto: 'minha idade é alta',
    });
    assert.equal(decisao.acao, 'avancar');
  });

  it('estouro avança sem eliminar a pergunta seguinte', () => {
    const agora = new Date('2026-10-07T15:00:31.000Z');
    assert.equal(tempoRestanteSegundos(estado(), agora, 30), -1);
    assert.equal(avaliarAviso(-1), 'expirar');
    assert.equal(avaliarAviso(10), 'avisar');
    const decisao = decidirTurno({ perguntas: PERGUNTAS, estado: estado(), agora, texto: 'tarde' });
    assert.equal(decisao.acao, 'expirar');
  });

  it('pausa o cronômetro na queda e reconecta na mesma janela', () => {
    const pausado = pausarTimer(estado(), new Date('2026-10-07T15:00:10.000Z'));
    const retomado = retomarTimer(pausado, new Date('2026-10-07T15:00:30.000Z'));
    assert.equal(tempoRestanteSegundos(retomado, new Date('2026-10-07T15:00:30.000Z'), 30), 20);
    assert.equal(
      avaliarReconexao(new Date('2026-10-07T15:00:10.000Z'), new Date('2026-10-07T15:00:30.000Z'), 60_000),
      'mesma_sessao',
    );
    assert.equal(
      avaliarReconexao(new Date('2026-10-07T15:00:10.000Z'), new Date('2026-10-07T15:01:11.000Z'), 60_000),
      'abandonar',
    );
  });

  it('exceção é única e a fila segura o excesso', () => {
    assert.equal(concederExcecao(false).ok, true);
    assert.equal(concederExcecao(true).ok, false);
    assert.equal(decidirAdmissao(1, 1), 'fila');
    assert.equal(decidirAdmissao(0, 1), 'admitir');
    assert.ok(percentil50([800, 100, 400]) < 1000);
  });
});
