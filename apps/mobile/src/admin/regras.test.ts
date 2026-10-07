import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { acoesDaEmpresa, validarAcaoAdmin } from './regras';

describe('regras das ações administrativas', () => {
  it('exige senha antes de qualquer ação', () => {
    assert.equal(validarAcaoAdmin('aprovar', '', ''), 'senha');
  });

  it('exige motivo para rejeitar e suspender, mas não para aprovar e reativar', () => {
    assert.equal(validarAcaoAdmin('rejeitar', 'senha-1', ' a '), 'motivo');
    assert.equal(validarAcaoAdmin('suspender', 'senha-1', ''), 'motivo');
    assert.equal(validarAcaoAdmin('suspender', 'senha-1', 'fraude'), null);
    assert.equal(validarAcaoAdmin('aprovar', 'senha-1', ''), null);
    assert.equal(validarAcaoAdmin('reativar', 'senha-1', ''), null);
  });

  it('oferece suspender para verificada e reativar para suspensa', () => {
    assert.deepEqual(acoesDaEmpresa('VERIFICADA'), ['suspender']);
    assert.deepEqual(acoesDaEmpresa('SUSPENSA'), ['reativar']);
    assert.deepEqual(acoesDaEmpresa('PENDENTE'), []);
  });
});
