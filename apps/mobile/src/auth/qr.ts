import qrcode from 'qrcode-generator';

/**
 * Matriz do QR code (true = módulo escuro) para uma URI como `otpauth://`. Nível de correção M:
 * sobra margem para telas com brilho baixo e a URI do TOTP cabe com folga.
 */
export function matrizQr(valor: string): boolean[][] {
  const qr = qrcode(0, 'M');
  qr.addData(valor);
  qr.make();
  const tamanho = qr.getModuleCount();
  return Array.from({ length: tamanho }, (_, linha) => Array.from({ length: tamanho }, (_, coluna) => qr.isDark(linha, coluna)));
}
