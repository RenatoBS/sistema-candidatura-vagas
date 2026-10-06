import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CATALOGO_BASE, type ItemCatalogo } from '@scv/domain';

import { docxComTexto } from './fixtures/docx';
import { pdfComTexto } from './fixtures/gerar';
import { criarDepsOcrMock, processarArquivoCurriculo } from './processar-curriculo';
import { lerTextoDocx, lerTextoPdf } from './texto-nativo';

const catalogo: ItemCatalogo[] = CATALOGO_BASE.map((item, indice) => ({
  ...item,
  id: `00000000-0000-4000-8000-${String(indice + 1).padStart(12, '0')}`,
}));

const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

describe('extração nativa', () => {
  it('lê a camada de texto do PDF e não passa pelo OCR', async () => {
    const pdf = await pdfComTexto('Engenheira TypeScript PostgreSQL');
    const paginas = await lerTextoPdf(pdf);
    assert.match(paginas[0]?.textoNativo ?? '', /TypeScript/);
    let ocr = 0;
    const deps = criarDepsOcrMock();
    deps.ocr = {
      reconhecer: async () => {
        ocr += 1;
        return { texto: 'nao', confianca: 1 };
      },
    };
    const resultado = await processarArquivoCurriculo({ buffer: pdf, mimeType: 'application/pdf' }, deps, catalogo);
    assert.equal(ocr, 0);
    assert.equal(resultado.metodoExtracao, 'NATIVO');
  });

  it('lê DOCX', async () => {
    const docx = docxComTexto('Analista com TypeScript');
    const texto = await lerTextoDocx(docx);
    assert.match(texto, /TypeScript/);
    const resultado = await processarArquivoCurriculo({ buffer: docx, mimeType: MIME_DOCX }, criarDepsOcrMock(), catalogo);
    assert.equal(resultado.metodoExtracao, 'NATIVO');
    assert.ok(resultado.dados.habilidades.some((item) => item.nome === 'TypeScript'));
  });
});
