import net from 'node:net';
import { envNumero } from '@scv/env';

export type ResultadoAntivirus = 'LIMPO' | 'INFECTADO';

export interface Antivirus {
  escanear(corpo: Buffer): Promise<ResultadoAntivirus>;
}

const ASSINATURA_EICAR = 'EICAR-STANDARD-ANTIVIRUS-TEST-FILE';

/** Mock usado em testes e quando o ClamAV não está configurado. Ainda recusa a assinatura EICAR. */
export class AntivirusMock implements Antivirus {
  async escanear(corpo: Buffer): Promise<ResultadoAntivirus> {
    if (corpo.includes(Buffer.from(ASSINATURA_EICAR))) return 'INFECTADO';
    return 'LIMPO';
  }
}

export class AntivirusClamAv implements Antivirus {
  constructor(
    private readonly host: string,
    private readonly port: number,
    private readonly timeoutMs = 15_000,
  ) {}

  escanear(corpo: Buffer): Promise<ResultadoAntivirus> {
    return new Promise((resolve, reject) => {
      const socket = net.connect(this.port, this.host);
      const pedacos: Buffer[] = [];
      const falhar = (erro: Error) => {
        socket.destroy();
        reject(erro);
      };
      socket.setTimeout(this.timeoutMs, () => falhar(new Error('clamav timeout')));
      socket.on('error', falhar);
      socket.on('data', (parte) => pedacos.push(parte));
      socket.on('end', () => {
        const texto = Buffer.concat(pedacos).toString('utf8');
        if (texto.includes('FOUND')) {
          resolve('INFECTADO');
          return;
        }
        if (texto.includes('OK')) {
          resolve('LIMPO');
          return;
        }
        reject(new Error('resposta clamav desconhecida'));
      });
      socket.on('connect', () => {
        socket.write('zINSTREAM\0');
        const tamanhoChunk = 64 * 1024;
        for (let i = 0; i < corpo.length; i += tamanhoChunk) {
          const parte = corpo.subarray(i, i + tamanhoChunk);
          const prefixo = Buffer.alloc(4);
          prefixo.writeUInt32BE(parte.length, 0);
          socket.write(prefixo);
          socket.write(parte);
        }
        const fim = Buffer.alloc(4);
        fim.writeUInt32BE(0, 0);
        socket.write(fim);
      });
    });
  }
}

export function criarAntivirus(env: NodeJS.ProcessEnv = process.env): Antivirus {
  if (env.CLAMAV_HOST) {
    return new AntivirusClamAv(env.CLAMAV_HOST, envNumero(env, 'CLAMAV_PORT', 3310));
  }
  return new AntivirusMock();
}
