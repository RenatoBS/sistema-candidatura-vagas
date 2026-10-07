import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createInstance } from 'i18next';

import ptBR from './locales/pt-BR.json';

describe('rótulos das listas', () => {
  it('pluraliza processos e vagas e mantém o nome do produto', async () => {
    const i18n = createInstance();
    await i18n.init({
      lng: 'pt-BR',
      resources: { 'pt-BR': { translation: ptBR } },
      interpolation: { escapeValue: false },
    });

    assert.equal(i18n.t('home.title'), 'Sistema de Candidatura a Vagas');
    assert.equal(i18n.t('candidato.seusProcessos'), 'Seus processos');
    assert.equal(i18n.t('candidato.contadorProcessos', { count: 1 }), '1 processo');
    assert.equal(i18n.t('candidato.contadorProcessos', { count: 2 }), '2 processos');
    assert.equal(i18n.t('empresa.suasVagas'), 'Suas vagas');
    assert.equal(i18n.t('empresa.contadorVagas', { count: 1 }), '1 vaga');
    assert.equal(i18n.t('empresa.contadorVagas', { count: 4 }), '4 vagas');
    assert.equal(JSON.stringify(ptBR).includes('Vitta'), false);

    const marca = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../design-system/Marca.tsx'), 'utf8');
    assert.equal(marca.includes('Vitta'), false);
    assert.equal(marca.includes("t('home.title')"), true);
  });
});
