import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { describe, it } from 'node:test';
import { ConversorAudioFake, FfmpegConversor } from './conversor-audio';
describe('conversor de áudio', () => {
  it('fake é determinístico', async () => {
    const resultado = await new ConversorAudioFake().converter(Buffer.from('a'), 'audio/ogg');
    assert.deepEqual(resultado.wav, Buffer.from('a'));
  });
  it('converte áudio sintético quando ffmpeg está disponível', async (context) => {
    try {
      execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    } catch {
      context.skip('ffmpeg ausente');
      return;
    }
    const ogg = execFileSync('ffmpeg', [
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=440:duration=1',
      '-f',
      'ogg',
      'pipe:1',
    ]);
    const resultado = await new FfmpegConversor().converter(ogg, 'audio/ogg');
    assert.equal(resultado.wav.subarray(0, 4).toString(), 'RIFF');
    assert.ok(resultado.duracaoSegundos > 0.95 && resultado.duracaoSegundos < 1.05);
  });
});
