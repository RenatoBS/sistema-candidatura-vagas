import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { percentualInteiro } from './opcoes';
import { etapasComPerguntas, etapasIncompletas, processoPronto, situacaoEtapa, type EtapaProcesso } from './processo';

function etapa(parcial: Partial<EtapaProcesso> & Pick<EtapaProcesso, 'id' | 'ordem' | 'tipo' | 'numeroPerguntas'>): EtapaProcesso {
  return { perguntas: [], sugestoes: [], ...parcial };
}

function perguntas(n: number) {
  return Array.from({ length: n }, (_, i) => ({ id: `p${i}`, enunciado: `Pergunta ${i}`, tempoLimiteEfetivoSegundos: 180 }));
}

describe('etapas do processo seletivo', () => {
  const triagemCompleta = etapa({ id: 't', ordem: 1, tipo: 'TRIAGEM_WHATSAPP', numeroPerguntas: 5, perguntas: perguntas(5) });
  const vozIncompleta = etapa({
    id: 'v',
    ordem: 2,
    tipo: 'ENTREVISTA_VOZ',
    numeroPerguntas: 5,
    perguntas: perguntas(3),
    sugestoes: [{ id: 's1', enunciado: 'Sugestão' }],
  });
  const revisao = etapa({ id: 'r', ordem: 3, tipo: 'REVISAO_HUMANA', numeroPerguntas: 0 });

  it('etapa completa exige todas aprovadas e nenhuma sugestão pendente', () => {
    assert.deepEqual(situacaoEtapa(triagemCompleta), { aprovadas: 5, pendentes: 0, numeroPerguntas: 5, completa: true });
    assert.equal(situacaoEtapa(vozIncompleta).completa, false);
    const comPendente = { ...triagemCompleta, sugestoes: [{ id: 'x', enunciado: 'extra' }] };
    assert.equal(situacaoEtapa(comPendente).completa, false);
  });

  it('lista só etapas com perguntas, na ordem', () => {
    assert.deepEqual(
      etapasComPerguntas([revisao, vozIncompleta, triagemCompleta]).map((item) => item.id),
      ['t', 'v'],
    );
  });

  it('publicação só fica liberada com todas as etapas completas', () => {
    assert.deepEqual(etapasIncompletas([triagemCompleta, vozIncompleta, revisao]).map((item) => item.id), ['v']);
    assert.equal(processoPronto([triagemCompleta, vozIncompleta, revisao]), false);
    const vozCompleta = { ...vozIncompleta, perguntas: perguntas(5), sugestoes: [] };
    assert.equal(processoPronto([triagemCompleta, vozCompleta, revisao]), true);
    assert.equal(processoPronto([]), false);
    assert.equal(processoPronto(null), false);
  });

  it('completude vira percentual inteiro', () => {
    assert.equal(percentualInteiro(0.6666666666666666), 67);
    assert.equal(percentualInteiro(1), 100);
    assert.equal(percentualInteiro(null), 0);
  });
});
