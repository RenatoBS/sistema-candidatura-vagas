/**
 * Interfaces de provedores externos.
 * Implementações reais serão adicionadas nas fases 3–8.
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
