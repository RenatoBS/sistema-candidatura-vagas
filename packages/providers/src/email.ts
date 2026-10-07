import { envNumero, envOu } from '@scv/env';
import nodemailer from 'nodemailer';

export interface MensagemEmail {
  para: string;
  assunto: string;
  texto: string;
}

export interface EmailProvider {
  enviar(mensagem: MensagemEmail): Promise<void>;
}

/** Usado em desenvolvimento quando não há SMTP: guarda a mensagem e registra no log. */
export class EmailLogProvider implements EmailProvider {
  readonly enviados: MensagemEmail[] = [];

  constructor(private readonly escreverLog = true) {}

  async enviar(mensagem: MensagemEmail): Promise<void> {
    this.enviados.push(mensagem);
    if (this.escreverLog) {
      console.info(
        JSON.stringify({
          msg: 'e-mail de desenvolvimento',
          para: mensagem.para,
          assunto: mensagem.assunto,
          texto: mensagem.texto,
        }),
      );
    }
  }

  ultimoPara(email: string): MensagemEmail | undefined {
    return [...this.enviados].reverse().find((mensagem) => mensagem.para === email);
  }

  limpar(): void {
    this.enviados.length = 0;
  }
}

export class EmailSmtpProvider implements EmailProvider {
  constructor(
    private readonly host: string,
    private readonly port: number,
    private readonly from: string,
  ) {}

  async enviar(mensagem: MensagemEmail): Promise<void> {
    const transporte = nodemailer.createTransport({
      host: this.host,
      port: this.port,
      secure: false,
    });
    await transporte.sendMail({
      from: this.from,
      to: mensagem.para,
      subject: mensagem.assunto,
      text: mensagem.texto,
    });
  }
}

export function criarEmailProvider(env: NodeJS.ProcessEnv = process.env): EmailProvider {
  if (env.SMTP_HOST) {
    return new EmailSmtpProvider(
      env.SMTP_HOST,
      envNumero(env, 'SMTP_PORT', 1025),
      envOu(env, 'SMTP_FROM', 'nao-responda@localhost'),
    );
  }
  return new EmailLogProvider(env.NODE_ENV !== 'test');
}
