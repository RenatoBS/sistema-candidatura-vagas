import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatarDataHora } from './data';

describe('formatarDataHora', () => {
  it('converte ISO UTC para o horário de Brasília', () => {
    assert.equal(formatarDataHora('2026-10-07T12:25:46.768Z'), '07/10/2026 09:25');
  });

  it('vira o dia quando o UTC já passou da meia-noite', () => {
    assert.equal(formatarDataHora('2026-01-01T02:05:00Z'), '31/12/2025 23:05');
  });

  it('respeita o fuso informado no ISO', () => {
    assert.equal(formatarDataHora('2026-11-20T23:59:00-03:00'), '20/11/2026 23:59');
  });

  it('devolve null para vazio ou inválido', () => {
    assert.equal(formatarDataHora(null), null);
    assert.equal(formatarDataHora(undefined), null);
    assert.equal(formatarDataHora(''), null);
    assert.equal(formatarDataHora('não é data'), null);
  });
});
