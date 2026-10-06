import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { baixaConfiancaOcr, classificarPaginas } from './paginas-curriculo';

describe('páginas do currículo', () => {
  it('não manda PDF com texto para o OCR', () => {
    const classe = classificarPaginas([{ numero: 1, textoNativo: 'Experiência como engenheira de software' }]);
    assert.deepEqual(classe, { ocr: [], metodo: 'NATIVO' });
  });

  it('manda só as páginas sem texto no PDF misto', () => {
    const classe = classificarPaginas([
      { numero: 1, textoNativo: 'Página com camada de texto suficiente' },
      { numero: 2, textoNativo: '' },
    ]);
    assert.deepEqual(classe, { ocr: [2], metodo: 'MISTO' });
  });

  it('trata imagem e escaneado como OCR e avisa confiança baixa', () => {
    const classe = classificarPaginas([{ numero: 1, textoNativo: '   ' }]);
    assert.equal(classe.metodo, 'OCR');
    assert.equal(baixaConfiancaOcr('OCR', 0.42), true);
    assert.equal(baixaConfiancaOcr('NATIVO', null), false);
  });
});
