export interface EtapaPipeline {
  nome: 'stt' | 'llm' | 'tts';
  duracaoMs: number;
}

/** Pipeline STT→LLM→TTS sem rede. A latência real do POC fica no voice-agent. */
export async function medirPipelineFake(texto: string): Promise<{ etapas: EtapaPipeline[]; totalMs: number; texto: string }> {
  const etapas: EtapaPipeline[] = [];
  let totalMs = 0;
  for (const nome of ['stt', 'llm', 'tts'] as const) {
    const inicio = performance.now();
    await Promise.resolve();
    const duracaoMs = performance.now() - inicio;
    etapas.push({ nome, duracaoMs });
    totalMs += duracaoMs;
  }
  return { etapas, totalMs, texto };
}
