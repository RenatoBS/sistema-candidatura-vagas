import { percentil50 } from './percentil';
import { medirEtapa } from './timer';

export interface EtapaTurno {
  nome: string;
  duracaoMs: number;
}

/**
 * Um turno do agente com STT → LLM → TTS simulado.
 * Não chama LiveKit nem OpenAI. O p50 local precisa ficar abaixo de 1 s.
 */
export async function conduzirTurnoMock(pergunta: string): Promise<{ resposta: string; etapas: EtapaTurno[]; totalMs: number }> {
  const stt = await medirEtapa('stt', async () => 'texto fictício do candidato');
  const llm = await medirEtapa('llm', async () => `Seguimos no roteiro: ${pergunta}`);
  const tts = await medirEtapa('tts', async () => 'audio-fake');
  const etapas = [
    { nome: 'stt', duracaoMs: stt.duracaoMs },
    { nome: 'llm', duracaoMs: llm.duracaoMs },
    { nome: 'tts', duracaoMs: tts.duracaoMs },
  ];
  return {
    resposta: llm.resultado,
    etapas,
    totalMs: etapas.reduce((soma, etapa) => soma + etapa.duracaoMs, 0),
  };
}

export function p50DoTurno(totaisMs: number[]): number {
  return percentil50(totaisMs);
}
