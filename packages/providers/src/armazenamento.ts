import { randomUUID } from 'node:crypto';

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { envOu } from '@scv/env';

export interface PedidoUpload {
  key: string;
  mimeType: string;
  tamanhoBytes: number;
  baseApi?: string;
}

export interface UrlUpload {
  url: string;
  headers: Record<string, string>;
}

export interface Armazenamento {
  salvar(key: string, corpo: Buffer, mimeType: string): Promise<void>;
  criarUrlUpload(pedido: PedidoUpload): Promise<UrlUpload>;
  criarUrlDownload(key: string, segundos: number): Promise<string>;
  ler(key: string): Promise<Buffer | null>;
  apagar(key: string): Promise<void>;
}

interface ReservaUpload {
  key: string;
  mimeType: string;
  tamanhoBytes: number;
  corpo: Buffer | null;
}

export class ArmazenamentoMemoria implements Armazenamento {
  async salvar(key: string, corpo: Buffer): Promise<void> {
    this.objetos.set(key, Buffer.from(corpo));
  }
  private readonly reservas = new Map<string, ReservaUpload>();
  private readonly objetos = new Map<string, Buffer>();

  async criarUrlUpload(pedido: PedidoUpload): Promise<UrlUpload> {
    const token = randomUUID();
    this.reservas.set(token, { ...pedido, corpo: null });
    const base = pedido.baseApi ?? 'http://localhost:3000';
    return {
      url: `${base}/interno/uploads/${token}`,
      headers: { 'content-type': 'application/octet-stream' },
    };
  }

  receber(
    token: string,
    corpo: Buffer,
  ): { ok: true; key: string } | { ok: false; codigo: 'UPLOAD_INVALIDO' | 'TAMANHO_INVALIDO' } {
    const reserva = this.reservas.get(token);
    if (!reserva) return { ok: false, codigo: 'UPLOAD_INVALIDO' };
    if (corpo.length !== reserva.tamanhoBytes) return { ok: false, codigo: 'TAMANHO_INVALIDO' };
    this.objetos.set(reserva.key, Buffer.from(corpo));
    reserva.corpo = Buffer.from(corpo);
    return { ok: true, key: reserva.key };
  }

  async criarUrlDownload(key: string, segundos: number): Promise<string> {
    return `http://localhost/audio/${encodeURIComponent(key)}?expira=${segundos}`;
  }

  async ler(key: string): Promise<Buffer | null> {
    const corpo = this.objetos.get(key);
    return corpo ? Buffer.from(corpo) : null;
  }

  async apagar(key: string): Promise<void> {
    this.objetos.delete(key);
  }

  limpar(): void {
    this.reservas.clear();
    this.objetos.clear();
  }
}

export function criarArmazenamentoS3(env: NodeJS.ProcessEnv = process.env): ArmazenamentoS3 {
  const chave = envOu(env, 'S3_ACCESS_KEY', '');
  const segredo = envOu(env, 'S3_SECRET_KEY', '');
  if (!chave || !segredo) throw new Error('S3_ACCESS_KEY e S3_SECRET_KEY devem ser definidas');
  return new ArmazenamentoS3({
    endpoint: envOu(env, 'S3_ENDPOINT', 'http://localhost:9000'),
    bucket: envOu(env, 'S3_BUCKET', 'scv-dev'),
    accessKeyId: chave,
    secretAccessKey: segredo,
  });
}

export class ArmazenamentoS3 implements Armazenamento {
  private readonly cliente: S3Client;

  constructor(
    private readonly config: {
      endpoint: string;
      bucket: string;
      accessKeyId: string;
      secretAccessKey: string;
    },
  ) {
    this.cliente = new S3Client({
      region: 'us-east-1',
      endpoint: config.endpoint,
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  async criarUrlUpload(pedido: PedidoUpload): Promise<UrlUpload> {
    const comando = new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: pedido.key,
      ContentType: pedido.mimeType,
      ContentLength: pedido.tamanhoBytes,
    });
    const url = await getSignedUrl(this.cliente, comando, { expiresIn: 900 });
    return {
      url,
      headers: {
        'content-type': pedido.mimeType,
        'content-length': String(pedido.tamanhoBytes),
      },
    };
  }

  async salvar(key: string, corpo: Buffer, mimeType: string): Promise<void> {
    await this.cliente.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: corpo,
        ContentType: mimeType,
        ContentLength: corpo.length,
      }),
    );
  }

  async criarUrlDownload(key: string, segundos: number): Promise<string> {
    const comando = new GetObjectCommand({ Bucket: this.config.bucket, Key: key });
    return getSignedUrl(this.cliente, comando, { expiresIn: segundos });
  }

  async ler(key: string): Promise<Buffer | null> {
    try {
      const saida = await this.cliente.send(
        new GetObjectCommand({ Bucket: this.config.bucket, Key: key }),
      );
      const bytes = await saida.Body?.transformToByteArray();
      return bytes ? Buffer.from(bytes) : null;
    } catch {
      return null;
    }
  }

  async apagar(key: string): Promise<void> {
    await this.cliente.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }));
  }
}
