/**
 * Interfaces e adapters de provedores externos.
 */

export { FakeWhatsappProvider, UazapiProvider } from './whatsapp';
export type {
  DownloadMidiaWhatsapp,
  EnvioWhatsapp,
  EscolhaWhatsapp,
  MensagemWhatsapp,
  MidiaWhatsapp,
  TipoMidiaWhatsapp,
  WhatsappProvider,
} from './whatsapp';

export interface SttProvider {
  transcribe(audioUrl: string): Promise<{ text: string; confidence: number }>;
}

export type { LlmProvider, PedidoLlm, RespostaLlm } from '@scv/llm';

export interface OcrProvider {
  extractText(imageBuffer: Buffer): Promise<string>;
}

export { ArmazenamentoMemoria, ArmazenamentoS3, criarArmazenamentoS3 } from './armazenamento';
export type { Armazenamento, PedidoUpload, UrlUpload } from './armazenamento';
export { AntivirusClamAv, AntivirusMock, criarAntivirus } from './antivirus';
export type { Antivirus, ResultadoAntivirus } from './antivirus';
export {
  criarEmbeddingProvider,
  EmbeddingOpenAiCompativel,
  FakeEmbeddingProvider,
} from './embeddings';
export type { AmbienteEmbedding, EmbeddingProvider, FetchEmbedding } from './embeddings';
export { ExtratorEstruturadoMock } from './extrator-estruturado';
export type { ExtratorEstruturadoCurriculo } from './extrator-estruturado';
export { criarExtratorEstruturado, ExtratorEstruturadoLlm } from './extrator-estruturado-llm';
export { executarJobCurriculo } from './job-curriculo';
export { OcrMock, TesseractOcr } from './ocr';
export {
  criarDepsOcrMock,
  criarDepsOcrReal,
  processarArquivoCurriculo,
} from './processar-curriculo';
export type { DependenciasExtracao, ResultadoProcessamento } from './processar-curriculo';

export { BrasilApiFonteCnpj, FonteCnpjControlavel } from './cnpj';
export type { FonteCnpjProvider, ResultadoFonteCnpj } from './cnpj';
export { cifrar, decifrar } from './criptografia';
export { criarEmailProvider, EmailLogProvider, EmailSmtpProvider } from './email';
export type { EmailProvider, MensagemEmail } from './email';
export {
  DeviceNotRegisteredError,
  ExpoPushProvider,
  MockPushProvider,
  criarPushProvider,
} from './push';
export type { PushMessage, PushProvider } from './push';
export { FakeUazapiInstancia, UazapiInstanciaCliente } from './uazapi-instancia';
export type {
  ClienteInstanciaWhatsapp,
  ConexaoInstancia,
  InstanciaCriada,
  StatusInstanciaProvedor,
} from './uazapi-instancia';
