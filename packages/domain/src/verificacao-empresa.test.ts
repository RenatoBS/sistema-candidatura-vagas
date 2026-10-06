import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  decidirAposChecagens,
  podePublicarVaga,
  transicionarEmpresa,
} from './verificacao-empresa';

describe('verificação da empresa', () => {
  it('libera a empresa quando as checagens passam e a política é falha', () => {
    const decisao = decidirAposChecagens(
      { email: 'OK', dominio: 'OK', cnpj: 'OK' },
      'falha',
    );
    assert.equal(decisao.status, 'VERIFICADA');
    assert.equal(decisao.exigeRevisaoManual, false);
  });

  it('manda para a fila quando o CNPJ falha ou a fonte está indisponível', () => {
    const inativo = decidirAposChecagens(
      { email: 'OK', dominio: 'OK', cnpj: 'FALHA' },
      'falha',
    );
    const fora = decidirAposChecagens(
      { email: 'OK', dominio: 'OK', cnpj: 'INDISPONIVEL' },
      'falha',
    );
    assert.equal(inativo.exigeRevisaoManual, true);
    assert.equal(fora.exigeRevisaoManual, true);
    assert.equal(inativo.status, 'PENDENTE');
  });

  it('manda para a fila quando o domínio não é confirmado', () => {
    const decisao = decidirAposChecagens(
      { email: 'OK', dominio: 'FALHA', cnpj: 'OK' },
      'falha',
    );
    assert.equal(decisao.exigeRevisaoManual, true);
  });

  it('com política sempre, checagens ok ainda exigem o admin', () => {
    const decisao = decidirAposChecagens(
      { email: 'OK', dominio: 'OK', cnpj: 'OK' },
      'sempre',
    );
    assert.equal(decisao.status, 'PENDENTE');
    assert.equal(decisao.exigeRevisaoManual, true);
  });

  it('com política nunca, falha não entra na fila', () => {
    const decisao = decidirAposChecagens(
      { email: 'OK', dominio: 'OK', cnpj: 'FALHA' },
      'nunca',
    );
    assert.equal(decisao.exigeRevisaoManual, false);
    assert.equal(decisao.status, 'PENDENTE');
  });

  it('bloqueia publicação fora de VERIFICADA e percorre os estados', () => {
    assert.equal(podePublicarVaga('PENDENTE', false), false);
    assert.equal(podePublicarVaga('REJEITADA', false), false);
    assert.equal(podePublicarVaga('SUSPENSA', false), false);
    assert.equal(podePublicarVaga('VERIFICADA', false), true);
    assert.equal(podePublicarVaga('PENDENTE', true), true);
    assert.equal(transicionarEmpresa('PENDENTE', 'aprovar'), 'VERIFICADA');
    assert.equal(transicionarEmpresa('PENDENTE', 'rejeitar'), 'REJEITADA');
    assert.equal(transicionarEmpresa('REJEITADA', 'reenviar'), 'PENDENTE');
    assert.equal(transicionarEmpresa('VERIFICADA', 'suspender'), 'SUSPENSA');
    assert.equal(transicionarEmpresa('SUSPENSA', 'reativar'), 'VERIFICADA');
    assert.equal(transicionarEmpresa('VERIFICADA', 'aprovar'), null);
  });
});
