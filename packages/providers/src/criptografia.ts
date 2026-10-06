import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITMO = 'aes-256-gcm';
const IV_BYTES = 12;

export function chaveAesDeBase64(chaveBase64: string): Buffer {
  const chave = Buffer.from(chaveBase64, 'base64');
  if (chave.length !== 32) {
    throw new Error('APP_ENCRYPTION_KEY deve ser 32 bytes em base64');
  }
  return chave;
}

/** AES-256-GCM. Formato: base64(iv).base64(tag).base64(ciphertext). */
export function cifrar(texto: string, chaveBase64: string): string {
  const chave = chaveAesDeBase64(chaveBase64);
  const iv = randomBytes(IV_BYTES);
  const cifra = createCipheriv(ALGORITMO, chave, iv);
  const conteudo = Buffer.concat([cifra.update(texto, 'utf8'), cifra.final()]);
  const tag = cifra.getAuthTag();
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${conteudo.toString('base64url')}`;
}

export function decifrar(payload: string, chaveBase64: string): string {
  const [ivParte, tagParte, conteudoParte] = payload.split('.');
  if (!ivParte || !tagParte || !conteudoParte) {
    throw new Error('payload cifrado inválido');
  }
  const chave = chaveAesDeBase64(chaveBase64);
  const decifra = createDecipheriv(ALGORITMO, chave, Buffer.from(ivParte, 'base64url'));
  decifra.setAuthTag(Buffer.from(tagParte, 'base64url'));
  const texto = Buffer.concat([
    decifra.update(Buffer.from(conteudoParte, 'base64url')),
    decifra.final(),
  ]);
  return texto.toString('utf8');
}
