import assert from 'node:assert/strict';
import net from 'node:net';
import { describe, it } from 'node:test';

import { AntivirusClamAv, AntivirusMock } from './antivirus';

describe('antivírus', () => {
  it('mock recusa EICAR e aceita arquivo limpo', async () => {
    const antivirus = new AntivirusMock();
    assert.equal(await antivirus.escanear(Buffer.from('%PDF limpo')), 'LIMPO');
    assert.equal(await antivirus.escanear(Buffer.from('EICAR-STANDARD-ANTIVIRUS-TEST-FILE')), 'INFECTADO');
  });

  it('adapter ClamAV interpreta OK e FOUND', async () => {
    const servidor = net.createServer((socket) => {
      socket.on('data', (dados) => {
        const texto = dados.toString('utf8');
        if (texto.includes('VIRUS')) socket.end('stream: Eicar-Test-Signature FOUND\0');
        else if (texto.includes('\0') && texto.startsWith('zINSTREAM')) socket.end('stream: OK\0');
      });
    });
    await new Promise<void>((resolve) => servidor.listen(0, '127.0.0.1', resolve));
    const endereco = servidor.address();
    if (!endereco || typeof endereco === 'string') throw new Error('porta');
    const clam = new AntivirusClamAv('127.0.0.1', endereco.port);
    try {
      assert.equal(await clam.escanear(Buffer.from('arquivo limpo')), 'LIMPO');
      assert.equal(await clam.escanear(Buffer.from('VIRUS')), 'INFECTADO');
    } finally {
      servidor.close();
    }
  });
});
