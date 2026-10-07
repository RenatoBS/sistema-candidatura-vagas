import { spawn } from 'node:child_process';
export interface ConversorAudio {
  converter(audio: Buffer, mimetype: string): Promise<{ wav: Buffer; duracaoSegundos: number }>;
}
export function duracaoWav(wav: Buffer): number {
  if (wav.length < 44 || wav.subarray(0, 4).toString() !== 'RIFF') return 0;
  const canais = wav.readUInt16LE(22);
  const taxa = wav.readUInt32LE(24);
  const bits = wav.readUInt16LE(34);
  const inicio = wav.indexOf('data', 36, 'ascii');
  if (inicio < 0 || !canais || !taxa || !bits) return 0;
  return wav.readUInt32LE(inicio + 4) / (taxa * canais * (bits / 8));
}
export class ConversorAudioFake implements ConversorAudio {
  async converter(
    audio: Buffer,
    _mimetype?: string,
  ): Promise<{ wav: Buffer; duracaoSegundos: number }> {
    return { wav: Buffer.from(audio), duracaoSegundos: duracaoWav(audio) || 1 };
  }
}
export class FfmpegConversor implements ConversorAudio {
  constructor(private readonly timeoutMs = 30000) {}
  converter(audio: Buffer, _mimetype?: string): Promise<{ wav: Buffer; duracaoSegundos: number }> {
    return new Promise((resolve, reject) => {
      const processo = spawn('ffmpeg', [
        '-i',
        'pipe:0',
        '-ac',
        '1',
        '-ar',
        '16000',
        '-f',
        'wav',
        'pipe:1',
      ]);
      const partes: Buffer[] = [];
      let erro = '';
      const timer = setTimeout(() => {
        processo.kill('SIGKILL');
        reject(new Error('FFMPEG_TIMEOUT'));
      }, this.timeoutMs);
      processo.stdout.on('data', (parte) => partes.push(Buffer.from(parte)));
      processo.stderr.on('data', (parte) => {
        erro += String(parte);
      });
      processo.on('error', () => {
        clearTimeout(timer);
        reject(new Error('FFMPEG_INDISPONIVEL'));
      });
      processo.on('close', (codigo) => {
        clearTimeout(timer);
        if (codigo !== 0) reject(new Error(`FFMPEG_FALHA:${erro.slice(0, 100)}`));
        else {
          const wav = Buffer.concat(partes);
          resolve({ wav, duracaoSegundos: duracaoWav(wav) });
        }
      });
      processo.stdin.end(audio);
    });
  }
}
