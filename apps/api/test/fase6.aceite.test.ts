import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { criarCandidatura, transicionarCandidatura } from '@scv/domain';

describe('Fase 6 — critérios de aceite (F6-12)', () => {
  it('convite aceito vira INSCRITA e convite recusado vira CONVITE_EXPIRADO', () => {
    const convidada = criarCandidatura({ tipo: 'convidar', vagaAceitaInscricoes: true });
    assert.equal(convidada.ok, true);
    if (!convidada.ok) return;
    const aceita = transicionarCandidatura(convidada.estado, {
      tipo: 'aceitarConvite',
      vagaAceitaInscricoes: true,
    });
    assert.deepEqual(aceita, {
      ok: true,
      estado: { status: 'INSCRITA', statusAntesDaEspera: null },
      de: 'CONVIDADA',
    });

    const recusada = transicionarCandidatura(convidada.estado, { tipo: 'recusarConvite' });
    assert.deepEqual(recusada, {
      ok: true,
      estado: { status: 'CONVITE_EXPIRADO', statusAntesDaEspera: null },
      de: 'CONVIDADA',
    });
  });

  it('convite sem inscrições abertas expira e não aceita', () => {
    const convidada = criarCandidatura({ tipo: 'convidar', vagaAceitaInscricoes: true });
    assert.equal(convidada.ok, true);
    if (!convidada.ok) return;
    assert.deepEqual(
      transicionarCandidatura(convidada.estado, {
        tipo: 'aceitarConvite',
        vagaAceitaInscricoes: false,
      }),
      {
        ok: true,
        estado: { status: 'CONVITE_EXPIRADO', statusAntesDaEspera: null },
        de: 'CONVIDADA',
      },
    );
  });

  it('DTO público de candidatura contém apenas status/fase, nunca ranking', () => {
    const dto = {
      id: 'candidatura-1',
      vagaId: 'vaga-1',
      origem: 'DIRETA',
      status: 'INSCRITA',
      fase: 'Inscrita',
      etapaAtualId: null,
      criadoEm: new Date(),
      atualizadoEm: new Date(),
    };
    assert.equal('score' in dto, false);
    assert.equal('compatibilidade' in dto, false);
    assert.equal('posicao' in dto, false);
  });
});
