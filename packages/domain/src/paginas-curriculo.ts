export const MINIMO_CARACTERES_TEXTO_NATIVO = 20;
export const LIMIAR_CONFIANCA_OCR = 0.7;

export type MetodoExtracao = 'NATIVO' | 'OCR' | 'MISTO';

export interface PaginaNativa {
  numero: number;
  textoNativo: string;
}

export function paginaPrecisaOcr(textoNativo: string): boolean {
  return textoNativo.trim().length < MINIMO_CARACTERES_TEXTO_NATIVO;
}

export function classificarPaginas(paginas: PaginaNativa[]): { ocr: number[]; metodo: MetodoExtracao } {
  const ocr = paginas.filter((pagina) => paginaPrecisaOcr(pagina.textoNativo)).map((pagina) => pagina.numero);
  if (ocr.length === 0) return { ocr, metodo: 'NATIVO' };
  if (ocr.length === paginas.length) return { ocr, metodo: 'OCR' };
  return { ocr, metodo: 'MISTO' };
}

export function mediaConfianca(valores: number[]): number | null {
  if (valores.length === 0) return null;
  const soma = valores.reduce((total, valor) => total + valor, 0);
  return Math.round((soma / valores.length) * 1000) / 1000;
}

export function baixaConfiancaOcr(metodo: MetodoExtracao | null, confianca: number | null): boolean {
  if (metodo !== 'OCR' && metodo !== 'MISTO') return false;
  return confianca === null || confianca < LIMIAR_CONFIANCA_OCR;
}
