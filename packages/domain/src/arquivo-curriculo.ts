export const TAMANHO_MAX_CURRICULO_BYTES = 8 * 1024 * 1024;

export const MIMES_CURRICULO = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
] as const;

export type MimeCurriculo = (typeof MIMES_CURRICULO)[number];

export type DeclaracaoArquivo =
  | { ok: true; mimeType: MimeCurriculo; tamanhoBytes: number }
  | { ok: false; codigo: 'TIPO_INVALIDO' | 'TAMANHO_INVALIDO' };

export function validarDeclaracaoArquivo(mimeType: string, tamanhoBytes: number): DeclaracaoArquivo {
  if (!Number.isInteger(tamanhoBytes) || tamanhoBytes <= 0 || tamanhoBytes > TAMANHO_MAX_CURRICULO_BYTES) {
    return { ok: false, codigo: 'TAMANHO_INVALIDO' };
  }
  if (!MIMES_CURRICULO.includes(mimeType as MimeCurriculo)) return { ok: false, codigo: 'TIPO_INVALIDO' };
  return { ok: true, mimeType: mimeType as MimeCurriculo, tamanhoBytes };
}

export function mimePorAssinatura(buffer: Buffer): MimeCurriculo | null {
  if (buffer.length >= 4 && buffer.subarray(0, 4).toString('utf8') === '%PDF') return 'application/pdf';
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return 'image/png';
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) {
    if (buffer.includes(Buffer.from('word/document.xml'))) {
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    }
  }
  return null;
}

export function assinaturaConfere(buffer: Buffer, mimeType: string): boolean {
  return mimePorAssinatura(buffer) === mimeType;
}
