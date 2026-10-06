import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

export interface ReconhecimentoOcr {
  reconhecer(imagem: Buffer): Promise<{ texto: string; confianca: number }>;
}

export class OcrMock implements ReconhecimentoOcr {
  async reconhecer(imagem: Buffer): Promise<{ texto: string; confianca: number }> {
    const bruto = imagem.toString('latin1');
    const marca = 'SCVTEXT:';
    const inicio = bruto.indexOf(marca);
    if (inicio < 0) return { texto: '', confianca: 0.4 };
    const fim = bruto.indexOf('\0', inicio);
    const texto = bruto.slice(inicio + marca.length, fim === -1 ? undefined : fim).trim();
    return { texto, confianca: 0.93 };
  }
}

function executar(binario: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const processo = spawn(binario, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const saida: Buffer[] = [];
    const erro: Buffer[] = [];
    processo.stdout.on('data', (parte: Buffer) => saida.push(parte));
    processo.stderr.on('data', (parte: Buffer) => erro.push(parte));
    processo.on('error', reject);
    processo.on('close', (codigo) => {
      if (codigo !== 0) {
        reject(new Error(Buffer.concat(erro).toString('utf8') || `${binario} saiu com ${codigo}`));
        return;
      }
      resolve(Buffer.concat(saida).toString('utf8'));
    });
  });
}

export function interpretarTsvOcr(tsv: string): { texto: string; confianca: number } {
  const linhas = tsv.split(/\r?\n/).slice(1).filter(Boolean);
  const palavras: string[] = [];
  const confiancas: number[] = [];
  for (const linha of linhas) {
    const colunas = linha.split('\t');
    if (colunas.length < 12) continue;
    const confianca = Number(colunas[10]);
    const texto = colunas.slice(11).join('\t').trim();
    if (!texto || texto === '-1' || Number.isNaN(confianca) || confianca < 0) continue;
    palavras.push(texto);
    confiancas.push(confianca);
  }
  const media = confiancas.length
    ? confiancas.reduce((total, valor) => total + valor, 0) / confiancas.length / 100
    : 0;
  return { texto: palavras.join(' ').trim(), confianca: Math.round(media * 1000) / 1000 };
}

/** Tesseract local (`por+eng`). Não chama serviço de OCR externo. */
export class TesseractOcr implements ReconhecimentoOcr {
  constructor(private readonly binario = process.env.TESSERACT_BIN ?? 'tesseract') {}

  async reconhecer(imagem: Buffer): Promise<{ texto: string; confianca: number }> {
    const dir = await mkdtemp(path.join(tmpdir(), 'scv-ocr-'));
    const arquivo = path.join(dir, 'pagina.png');
    try {
      await writeFile(arquivo, imagem);
      const tsv = await executar(this.binario, [arquivo, 'stdout', '-l', 'por+eng', '--psm', '6', 'tsv']);
      return interpretarTsvOcr(tsv);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  async extractText(imagem: Buffer): Promise<string> {
    return (await this.reconhecer(imagem)).texto;
  }
}

export async function rasterizarPaginaPdf(pdf: Buffer, numero: number): Promise<Buffer> {
  const binario = process.env.PDFTOPPM_BIN ?? 'pdftoppm';
  const dir = await mkdtemp(path.join(tmpdir(), 'scv-pdf-'));
  const origem = path.join(dir, 'curriculo.pdf');
  const base = path.join(dir, 'pagina');
  try {
    await writeFile(origem, pdf);
    await executar(binario, ['-png', '-r', '200', '-f', String(numero), '-l', String(numero), '-singlefile', origem, base]);
    return await readFile(`${base}.png`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
