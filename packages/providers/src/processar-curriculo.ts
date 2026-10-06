import {
  dadosCurriculoValidos,
  mediaConfianca,
  paginaPrecisaOcr,
  type DadosCurriculo,
  type ItemCatalogo,
  type MetodoExtracao,
} from '@scv/domain';

import type { ExtratorEstruturadoCurriculo } from './extrator-estruturado';
import { ExtratorEstruturadoMock } from './extrator-estruturado';
import { criarExtratorEstruturado } from './extrator-estruturado-llm';
import { OcrMock, rasterizarPaginaPdf, TesseractOcr, type ReconhecimentoOcr } from './ocr';
import { preprocessarImagem } from './preprocessar';
import { lerTextoDocx, lerTextoPdf } from './texto-nativo';

const MIME_PDF = 'application/pdf';
const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export interface PaginaProcessada {
  numero: number;
  usouOcr: boolean;
  caracteres: number;
  etapas: string[];
}

export interface ResultadoProcessamento {
  metodoExtracao: MetodoExtracao;
  confiancaOcr: number | null;
  textoExtraido: string;
  dados: DadosCurriculo;
  paginas: PaginaProcessada[];
}

export interface DependenciasExtracao {
  lerPdf(buffer: Buffer): Promise<{ numero: number; textoNativo: string }[]>;
  lerDocx(buffer: Buffer): Promise<string>;
  rasterizarPdf(buffer: Buffer, numero: number): Promise<Buffer>;
  preprocessar(imagem: Buffer): Promise<{ buffer: Buffer; etapas: string[] }>;
  ocr: ReconhecimentoOcr;
  extrator: ExtratorEstruturadoCurriculo;
}

export function criarDepsOcrMock(): DependenciasExtracao {
  return {
    lerPdf: lerTextoPdf,
    lerDocx: lerTextoDocx,
    rasterizarPdf: async (buffer) => buffer,
    preprocessar: async (imagem) => ({ buffer: imagem, etapas: ['escala-cinza', 'binarizacao', 'deskew'] }),
    ocr: new OcrMock(),
    extrator: new ExtratorEstruturadoMock(),
  };
}

export function criarDepsOcrReal(env: NodeJS.ProcessEnv = process.env): DependenciasExtracao {
  return {
    lerPdf: lerTextoPdf,
    lerDocx: lerTextoDocx,
    rasterizarPdf: rasterizarPaginaPdf,
    preprocessar: preprocessarImagem,
    ocr: new TesseractOcr(),
    extrator: criarExtratorEstruturado(env),
  };
}

export async function processarArquivoCurriculo(
  arquivo: { buffer: Buffer; mimeType: string },
  deps: DependenciasExtracao,
  catalogo: ItemCatalogo[],
): Promise<ResultadoProcessamento> {
  const nativas = await paginasNativas(arquivo, deps);
  const confiancas: number[] = [];
  const textos: string[] = [];
  const paginas: PaginaProcessada[] = [];

  const ocrPermitido = arquivo.mimeType !== MIME_DOCX;
  for (const pagina of nativas) {
    if (!ocrPermitido || !paginaPrecisaOcr(pagina.textoNativo)) {
      textos.push(pagina.textoNativo.trim());
      paginas.push({
        numero: pagina.numero,
        usouOcr: false,
        caracteres: pagina.textoNativo.trim().length,
        etapas: [],
      });
      continue;
    }
    const raster = arquivo.mimeType === MIME_PDF ? await deps.rasterizarPdf(arquivo.buffer, pagina.numero) : arquivo.buffer;
    const pre = await deps.preprocessar(raster);
    const ocr = await deps.ocr.reconhecer(pre.buffer);
    confiancas.push(ocr.confianca);
    textos.push(ocr.texto.trim());
    paginas.push({
      numero: pagina.numero,
      usouOcr: true,
      caracteres: ocr.texto.trim().length,
      etapas: pre.etapas,
    });
  }

  const textoExtraido = textos.filter(Boolean).join('\n');
  const dados = await deps.extrator.extrair(textoExtraido, catalogo);
  if (!dadosCurriculoValidos(dados)) {
    throw new Error('extração estruturada inválida');
  }
  const comOcr = paginas.filter((pagina) => pagina.usouOcr).length;
  const metodoExtracao: MetodoExtracao =
    comOcr === 0 ? 'NATIVO' : comOcr === paginas.length ? 'OCR' : 'MISTO';
  return {
    metodoExtracao,
    confiancaOcr: mediaConfianca(confiancas),
    textoExtraido,
    dados,
    paginas,
  };
}

async function paginasNativas(
  arquivo: { buffer: Buffer; mimeType: string },
  deps: DependenciasExtracao,
): Promise<{ numero: number; textoNativo: string }[]> {
  if (arquivo.mimeType === MIME_PDF) return deps.lerPdf(arquivo.buffer);
  if (arquivo.mimeType === MIME_DOCX) {
    const texto = await deps.lerDocx(arquivo.buffer);
    return [{ numero: 1, textoNativo: texto }];
  }
  return [{ numero: 1, textoNativo: '' }];
}
