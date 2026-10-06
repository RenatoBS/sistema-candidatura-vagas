import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CATALOGO_BASE, type ItemCatalogo } from '@scv/domain';

import { ExtratorEstruturadoMock } from './extrator-estruturado';
import { processarArquivoCurriculo, type DependenciasExtracao } from './processar-curriculo';

const catalogo: ItemCatalogo[] = CATALOGO_BASE.map((item, indice) => ({
  ...item,
  id: `00000000-0000-4000-8000-${String(indice + 1).padStart(12, '0')}`,
}));

function deps(parcial: Partial<DependenciasExtracao> & Pick<DependenciasExtracao, 'lerPdf'>): DependenciasExtracao {
  return {
    lerDocx: async () => '',
    rasterizarPdf: async () => Buffer.from('SCVTEXT:pagina escaneada TypeScript\0'),
    preprocessar: async (imagem) => ({ buffer: imagem, etapas: ['escala-cinza', 'binarizacao', 'deskew'] }),
    ocr: {
      reconhecer: async (imagem) => ({ texto: imagem.toString('utf8'), confianca: 0.91 }),
    },
    extrator: new ExtratorEstruturadoMock(),
    ...parcial,
  };
}

describe('processamento de currículo', () => {
  it('PDF com texto não chama OCR', async () => {
    let ocr = 0;
    const resultado = await processarArquivoCurriculo(
      { buffer: Buffer.from('%PDF'), mimeType: 'application/pdf' },
      deps({
        lerPdf: async () => [{ numero: 1, textoNativo: 'Engenheira de software com TypeScript e PostgreSQL' }],
        ocr: {
          reconhecer: async () => {
            ocr += 1;
            return { texto: '', confianca: 1 };
          },
        },
      }),
      catalogo,
    );
    assert.equal(ocr, 0);
    assert.equal(resultado.metodoExtracao, 'NATIVO');
    assert.equal(resultado.confiancaOcr, null);
    assert.ok(resultado.dados.habilidades.some((item) => item.nome === 'TypeScript'));
  });

  it('PDF misto faz OCR só na página sem texto', async () => {
    const paginas: number[] = [];
    const resultado = await processarArquivoCurriculo(
      { buffer: Buffer.from('%PDF'), mimeType: 'application/pdf' },
      deps({
        lerPdf: async () => [
          { numero: 1, textoNativo: 'Experiência descrita na camada de texto do PDF' },
          { numero: 2, textoNativo: '' },
        ],
        rasterizarPdf: async (_buffer, numero) => {
          paginas.push(numero);
          return Buffer.from('texto da pagina 2');
        },
        ocr: { reconhecer: async () => ({ texto: 'Docker', confianca: 0.88 }) },
      }),
      catalogo,
    );
    assert.deepEqual(paginas, [2]);
    assert.equal(resultado.metodoExtracao, 'MISTO');
    assert.ok(resultado.textoExtraido.includes('Docker'));
  });

  it('imagem passa pelo OCR local', async () => {
    const resultado = await processarArquivoCurriculo(
      { buffer: Buffer.from('SCVTEXT:Analista PostgreSQL\0'), mimeType: 'image/png' },
      deps({
        lerPdf: async () => [],
        ocr: { reconhecer: async (imagem) => ({ texto: imagem.toString('utf8'), confianca: 0.5 }) },
      }),
      catalogo,
    );
    assert.equal(resultado.metodoExtracao, 'OCR');
    assert.equal(resultado.paginas[0]?.etapas.includes('deskew'), true);
    assert.ok(resultado.confiancaOcr !== null && resultado.confiancaOcr < 0.7);
  });

  it('DOCX usa texto nativo', async () => {
    let ocr = 0;
    const resultado = await processarArquivoCurriculo(
      { buffer: Buffer.from('PK'), mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
      deps({
        lerPdf: async () => [],
        lerDocx: async () => 'Resumo: pessoa desenvolvedora\nHabilidade: React',
        ocr: {
          reconhecer: async () => {
            ocr += 1;
            return { texto: '', confianca: 1 };
          },
        },
      }),
      catalogo,
    );
    assert.equal(ocr, 0);
    assert.equal(resultado.metodoExtracao, 'NATIVO');
    assert.equal(resultado.dados.resumo, 'pessoa desenvolvedora');
    assert.ok(resultado.dados.habilidades.some((item) => item.nome === 'React'));
  });
});
