import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { matrizQr } from './qr';

const URI = 'otpauth://totp/SCV:ana%40acme.com?secret=JBSWY3DPEHPK3PXP&issuer=SCV&digits=6&period=30';

describe('QR code do autenticador', () => {
  it('gera matriz quadrada determinística para a URI otpauth', () => {
    const matriz = matrizQr(URI);
    assert.ok(matriz.length >= 21, 'versão mínima do QR é 21x21');
    assert.ok(matriz.every((linha) => linha.length === matriz.length));
    assert.deepEqual(matrizQr(URI), matriz);
  });

  it('tem os três padrões de localização nos cantos (o que os leitores procuram)', () => {
    const matriz = matrizQr(URI);
    const n = matriz.length;
    // Borda externa 7x7 de cada padrão é toda escura.
    for (const [l0, c0] of [
      [0, 0],
      [0, n - 7],
      [n - 7, 0],
    ] as const) {
      for (let i = 0; i < 7; i += 1) {
        assert.equal(matriz[l0]?.[c0 + i], true);
        assert.equal(matriz[l0 + 6]?.[c0 + i], true);
        assert.equal(matriz[l0 + i]?.[c0], true);
        assert.equal(matriz[l0 + i]?.[c0 + 6], true);
      }
    }
    // O separador branco de 1 módulo ao redor de cada localizador também faz parte do padrão.
    assert.equal(matriz[7]?.[0], false);
    assert.equal(matriz[0]?.[7], false);
  });

  it('URIs diferentes geram matrizes diferentes', () => {
    assert.notDeepEqual(matrizQr(URI), matrizQr(URI.replace('JBSWY3DPEHPK3PXP', 'KRSXG5CTMVRXEZLU')));
  });
});
