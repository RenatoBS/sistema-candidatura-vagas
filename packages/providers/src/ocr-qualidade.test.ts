import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { CATALOGO_BASE, type ItemCatalogo } from '@scv/domain';
import sharp from 'sharp';

import { gravarFixtures } from './fixtures/gerar';
import { preprocessarImagem } from './preprocessar';
import { criarDepsOcrReal, processarArquivoCurriculo } from './processar-curriculo';

const catalogo: ItemCatalogo[] = CATALOGO_BASE.map((item, indice) => ({
  ...item,
  id: `00000000-0000-4000-8000-${String(indice + 1).padStart(12, '0')}`,
}));

function temBinario(nome: string): boolean {
  try {
    execFileSync('bash', ['-lc', `command -v ${nome}`], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

describe('qualidade do OCR local', () => {
  it('pré-processa com escala de cinza, binarização e deskew', async () => {
    const png = await sharp({
      create: { width: 48, height: 48, channels: 3, background: { r: 255, g: 255, b: 255 } },
    })
      .png()
      .toBuffer();
    const saida = await preprocessarImagem(png);
    assert.deepEqual(saida.etapas, ['escala-cinza', 'binarizacao', 'deskew']);
    assert.ok(saida.buffer.length > 0);
  });

  it('reconhece imagem e PDF escaneado com Tesseract por+eng', async (t) => {
    const disponivel = temBinario('tesseract') && temBinario('pdftoppm');
    if (!disponivel) {
      if (process.env.OCR_OBRIGATORIO === '1') {
        throw new Error('tesseract e pdftoppm são obrigatórios neste job');
      }
      t.skip('tesseract ou pdftoppm ausente');
      return;
    }
    const dir = mkdtempSync(path.join(tmpdir(), 'scv-fixtures-'));
    await gravarFixtures(dir);
    const imagem = readFileSync(path.join(dir, 'cv-imagem.png'));
    const escaneado = readFileSync(path.join(dir, 'cv-escaneado.pdf'));
    const deps = criarDepsOcrReal();
    const daImagem = await processarArquivoCurriculo({ buffer: imagem, mimeType: 'image/png' }, deps, catalogo);
    const doPdf = await processarArquivoCurriculo({ buffer: escaneado, mimeType: 'application/pdf' }, deps, catalogo);
    assert.equal(daImagem.metodoExtracao, 'OCR');
    assert.equal(doPdf.metodoExtracao, 'OCR');
    assert.match(daImagem.textoExtraido, /TypeScript/i);
    assert.match(doPdf.textoExtraido, /TypeScript/i);
    assert.match(daImagem.textoExtraido, /Analista/i);
  });
});
