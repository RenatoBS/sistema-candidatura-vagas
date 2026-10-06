import mammoth from 'mammoth';

interface ExtracaoUnpdf {
  getDocumentProxy(data: Uint8Array): Promise<{ destroy?: () => Promise<void> | void }>;
  extractText(
    pdf: unknown,
    opcoes: { mergePages: boolean },
  ): Promise<{ text: string | string[] }>;
}

export async function lerTextoPdf(buffer: Buffer): Promise<{ numero: number; textoNativo: string }[]> {
  const unpdf = (await import('unpdf')) as unknown as ExtracaoUnpdf;
  const pdf = await unpdf.getDocumentProxy(new Uint8Array(buffer));
  try {
    const extraido = await unpdf.extractText(pdf, { mergePages: false });
    const textos = Array.isArray(extraido.text) ? extraido.text : [extraido.text];
    if (textos.length === 0) return [{ numero: 1, textoNativo: '' }];
    return textos.map((texto, indice) => ({ numero: indice + 1, textoNativo: texto ?? '' }));
  } finally {
    await pdf.destroy?.();
  }
}

export async function lerTextoDocx(buffer: Buffer): Promise<string> {
  const resultado = await mammoth.extractRawText({ buffer });
  return resultado.value ?? '';
}
