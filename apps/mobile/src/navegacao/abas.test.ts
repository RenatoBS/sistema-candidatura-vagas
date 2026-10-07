import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { abaAtiva, barraVisivel } from './abas';

describe('abas', () => {
  it('mostra a barra nas rotas raiz do candidato e da empresa', () => {
    assert.equal(barraVisivel('candidato', '/candidato'), true);
    assert.equal(barraVisivel('candidato', '/candidato/vagas'), true);
    assert.equal(barraVisivel('candidato', '/candidato/candidaturas'), true);
    assert.equal(barraVisivel('candidato', '/candidato/notificacoes'), true);
    assert.equal(barraVisivel('candidato', '/candidato/perfil'), true);
    assert.equal(barraVisivel('empresa', '/empresa'), true);
    assert.equal(barraVisivel('empresa', '/empresa/vagas'), true);
    assert.equal(barraVisivel('empresa', '/empresa/notificacoes/'), true);
  });

  it('esconde a barra em telas profundas', () => {
    assert.equal(barraVisivel('candidato', '/candidato/vagas/abc'), false);
    assert.equal(barraVisivel('candidato', '/candidato/candidaturas/1'), false);
    assert.equal(barraVisivel('candidato', '/candidato/voz/x'), false);
    assert.equal(barraVisivel('candidato', '/candidato/curriculo'), false);
    assert.equal(barraVisivel('empresa', '/empresa/vagas/nova'), false);
    assert.equal(barraVisivel('empresa', '/empresa/vagas/id/ranking'), false);
    assert.equal(barraVisivel('empresa', '/empresa/whatsapp'), false);
  });

  it('marca a aba da lista mesmo no detalhe', () => {
    assert.equal(abaAtiva('candidato', '/candidato'), 'vagas');
    assert.equal(abaAtiva('candidato', '/candidato/vagas'), 'vagas');
    assert.equal(abaAtiva('candidato', '/candidato/vagas/1'), 'vagas');
    assert.equal(abaAtiva('candidato', '/candidato/perfil'), 'perfil');
    assert.equal(abaAtiva('empresa', '/empresa'), 'empresa');
    assert.equal(abaAtiva('empresa', '/empresa/vagas/x/ranking'), 'vagas');
    assert.equal(abaAtiva('empresa', '/empresa/whatsapp'), null);
  });
});
