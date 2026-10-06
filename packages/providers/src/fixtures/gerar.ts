import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { PDFDocument, StandardFonts } from 'pdf-lib';
import sharp from 'sharp';

import { docxComTexto } from './docx';

export const TEXTO_FIXTURE = 'Analista TypeScript PostgreSQL';

export async function pngComTexto(texto = TEXTO_FIXTURE): Promise<Buffer> {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="240">
  <rect width="100%" height="100%" fill="white"/>
  <text x="40" y="140" font-size="64" font-family="DejaVu Sans, sans-serif" fill="black">${texto}</text>
</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

export async function pdfComTexto(texto = TEXTO_FIXTURE): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const pagina = doc.addPage([700, 300]);
  const fonte = await doc.embedFont(StandardFonts.Helvetica);
  pagina.drawText(texto, { x: 40, y: 160, size: 28, font: fonte });
  return Buffer.from(await doc.save());
}

export async function pdfEscaneado(texto = TEXTO_FIXTURE): Promise<Buffer> {
  const png = await pngComTexto(texto);
  const doc = await PDFDocument.create();
  const imagem = await doc.embedPng(png);
  const pagina = doc.addPage([imagem.width, imagem.height]);
  pagina.drawImage(imagem, { x: 0, y: 0, width: imagem.width, height: imagem.height });
  return Buffer.from(await doc.save());
}

export async function gravarFixtures(diretorio: string): Promise<void> {
  mkdirSync(diretorio, { recursive: true });
  writeFileSync(path.join(diretorio, 'cv-texto.pdf'), await pdfComTexto());
  writeFileSync(path.join(diretorio, 'cv-escaneado.pdf'), await pdfEscaneado());
  writeFileSync(path.join(diretorio, 'cv-imagem.png'), await pngComTexto());
  writeFileSync(path.join(diretorio, 'cv-texto.docx'), docxComTexto(TEXTO_FIXTURE));
}
