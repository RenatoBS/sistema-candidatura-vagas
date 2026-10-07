import { spawn } from 'node:child_process';
export interface ConversorAudio {
  converter(audio: Buffer, mimetype: string): Promise<{ wav: Buffer; duracaoSegundos: number }>;
}
export class ConversorAudioFake implements ConversorAudio {
  async converter(audio: Buffer): Promise<{ wav: Buffer; duracaoSegundos: number }> {
    return { wav: Buffer.from(audio), duracaoSegundos: 1 };
  }
}
export class FfmpegConversor implements ConversorAudio {
  constructor(private readonly timeoutMs = 30000) {}
  converter(audio: Buffer): Promise<{ wav: Buffer; duracaoSegundos: number }> {
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
        else resolve({ wav: Buffer.concat(partes), duracaoSegundos: 0 });
      });
      processo.stdin.end(audio);
    });
  }
}
