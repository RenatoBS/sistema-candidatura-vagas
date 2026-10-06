import { createHash, createHmac, randomBytes, randomInt } from 'node:crypto';

const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function hashSegredo(valor: string): string {
  return createHash('sha256').update(valor).digest('hex');
}

export function segredoUrl(): string {
  return randomBytes(32).toString('base64url');
}

export function codigoNumerico(digitos = 8): string {
  return randomInt(0, 10 ** digitos)
    .toString()
    .padStart(digitos, '0');
}

export function gerarSegredoTotp(): string {
  return base32(randomBytes(20));
}

export function gerarCodigosRecuperacao(): string[] {
  return Array.from({ length: 8 }, () => {
    const bruto = randomBytes(4).toString('hex');
    return `${bruto.slice(0, 4)}-${bruto.slice(4)}`;
  });
}

function base32(buf: Buffer): string {
  let bits = '';
  for (const byte of buf) bits += byte.toString(2).padStart(8, '0');
  let saida = '';
  for (let i = 0; i < bits.length; i += 5) {
    saida += ALFABETO[Number.parseInt(bits.slice(i, i + 5).padEnd(5, '0'), 2)];
  }
  return saida;
}

function base32Decode(valor: string): Buffer {
  let bits = '';
  for (const char of valor.replace(/=+$/, '').toUpperCase()) {
    const idx = ALFABETO.indexOf(char);
    if (idx < 0) throw new Error('base32 inválido');
    bits += idx.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(Number.parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

export function codigoTotp(segredo: string, momento = Date.now()): string {
  const contador = Math.floor(momento / 1000 / 30);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(contador));
  const hmac = createHmac('sha1', base32Decode(segredo)).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const bin =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (bin % 1_000_000).toString().padStart(6, '0');
}

export function totpConfere(segredo: string, codigo: string, momento = Date.now()): boolean {
  const limpo = codigo.replace(/\s/g, '');
  for (const delta of [-1, 0, 1]) {
    if (codigoTotp(segredo, momento + delta * 30_000) === limpo) return true;
  }
  return false;
}

export function uriTotp(segredo: string, email: string): string {
  return `otpauth://totp/SCV:${encodeURIComponent(email)}?secret=${segredo}&issuer=SCV&digits=6&period=30`;
}

export function extrairCodigo(texto: string): string | null {
  const encontrado = texto.match(/codigo:([0-9]{6,8})/);
  return encontrado?.[1] ?? null;
}

export function extrairToken(texto: string): string | null {
  const encontrado = texto.match(/token:([A-Za-z0-9_-]+)/);
  return encontrado?.[1] ?? null;
}
