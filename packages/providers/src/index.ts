/**
 * Interfaces e adapters de provedores externos.
 */

export interface WhatsappProvider {
  sendText(to: string, message: string): Promise<void>;
}

export interface SttProvider {
  transcribe(audioUrl: string): Promise<{ text: string; confidence: number }>;
}

export interface LlmProvider {
  complete(prompt: string): Promise<string>;
}

export interface OcrProvider {
  extractText(imageBuffer: Buffer): Promise<string>;
}

export { BrasilApiFonteCnpj, FonteCnpjControlavel } from './cnpj';
export type { FonteCnpjProvider, ResultadoFonteCnpj } from './cnpj';
export { cifrar, decifrar } from './criptografia';
export { criarEmailProvider, EmailLogProvider, EmailSmtpProvider } from './email';
export type { EmailProvider, MensagemEmail } from './email';
export { FakeUazapiInstancia, UazapiInstanciaCliente } from './uazapi-instancia';
export type {
  ClienteInstanciaWhatsapp,
  ConexaoInstancia,
  InstanciaCriada,
  StatusInstanciaProvedor,
} from './uazapi-instancia';
