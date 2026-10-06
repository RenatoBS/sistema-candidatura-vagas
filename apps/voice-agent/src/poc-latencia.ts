#!/usr/bin/env node
/**
 * POC Fase 8.1 — mede latência de um turno de voz: STT → LLM → TTS.
 * Uso: pnpm --filter @scv/voice-agent poc [--mock] [--saida=relatorios]
 */
import { existsSync } from 'node:fs';
import path from 'node:path';

import { carregarConfig } from './config';
import { gerarResposta } from './providers/llm';
import { transcreverAudio } from './providers/stt';
import { sintetizarFala } from './providers/tts';
import { montarRelatorio, relatorioParaMarkdown, salvarRelatorio } from './report';
import { medirEtapa } from './timer';
import type { EtapaLatencia } from './types';

const ROOT = path.join(__dirname, '..');

function parseSaida(argv: string[]): string {
  const flag = argv.find((a) => a.startsWith('--saida='));
  if (flag) return path.resolve(process.cwd(), flag.split('=')[1] ?? 'relatorios');
  return path.resolve(ROOT, 'relatorios');
}

function nomePipeline(modo: string): string {
  switch (modo) {
    case 'mock':
      return 'STT → LLM → TTS (simulado, sem APIs)';
    case 'hibrido':
      return 'STT (OpenAI Whisper) → LLM (Ollama local) → TTS (OpenAI)';
    default:
      return 'STT (OpenAI Whisper) → LLM (OpenAI streaming) → TTS (OpenAI)';
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const config = carregarConfig(argv);
  const saida = parseSaida(argv);

  if (!existsSync(config.fixtureAudio)) {
    console.error(`Fixture de áudio não encontrado: ${config.fixtureAudio}`);
    console.error('Execute: pnpm --filter @scv/voice-agent gerar-fixture');
    process.exit(1);
  }

  console.log('=== POC Latência de Voz (Fase 8.1) ===');
  console.log(`Modo: ${config.modo}`);
  console.log(`Pipeline: ${nomePipeline(config.modo)}`);
  console.log(`Fixture: ${config.fixtureAudio}`);
  console.log('');

  const etapas: EtapaLatencia[] = [];
  const e2eInicio = performance.now();

  const vad = await medirEtapa(
    'vad_turno',
    async () => {
      await new Promise((r) => setTimeout(r, config.mock ? 220 : 250));
      return true;
    },
    'Simulação de detecção de fim de turno (POC sem WebRTC)',
  );
  etapas.push({
    etapa: 'vad_turno',
    inicioMs: vad.inicioMs,
    fimMs: vad.fimMs,
    duracaoMs: vad.duracaoMs,
    detalhe: vad.detalhe,
  });

  const stt = await medirEtapa('stt', () => transcreverAudio(config, config.fixtureAudio));
  etapas.push({
    etapa: 'stt',
    inicioMs: stt.inicioMs,
    fimMs: stt.fimMs,
    duracaoMs: stt.duracaoMs,
    detalhe: stt.resultado.provedor,
  });

  const llmInicio = performance.now();
  const llm = await gerarResposta(config, stt.resultado.texto);
  const llmFim = performance.now();
  etapas.push({
    etapa: 'llm',
    inicioMs: llmInicio,
    fimMs: llmFim,
    duracaoMs: llmFim - llmInicio,
    detalhe: `${llm.provedor}, TTFT=${llm.primeiroTokenMs.toFixed(1)}ms`,
  });

  const ttsInicio = performance.now();
  const tts = await sintetizarFala(config, llm.texto);
  const ttsFim = performance.now();
  etapas.push({
    etapa: 'tts',
    inicioMs: ttsInicio,
    fimMs: ttsFim,
    duracaoMs: ttsFim - ttsInicio,
    detalhe: `${tts.provedor}, 1º áudio=${tts.primeiroAudioMs.toFixed(1)}ms`,
  });

  const e2eMs = performance.now() - e2eInicio;

  const relatorio = montarRelatorio({
    modo: config.modo,
    pipeline: nomePipeline(config.modo),
    fixtureAudio: config.fixtureAudio,
    etapas,
    vadTurnoMs: vad.duracaoMs,
    sttMs: stt.duracaoMs,
    llmPrimeiroTokenMs: llm.primeiroTokenMs,
    llmTotalMs: llm.totalMs,
    ttsPrimeiroAudioMs: tts.primeiroAudioMs,
    ttsTotalMs: tts.totalMs,
    e2eMs,
    resultado: {
      transcricao: stt.resultado.texto,
      respostaLlm: llm.texto,
      audioRespostaBytes: tts.audio.length,
    },
  });

  const arquivos = salvarRelatorio(relatorio, saida);

  console.log(relatorioParaMarkdown(relatorio));
  console.log('');
  console.log(`Relatório JSON: ${arquivos.json}`);
  console.log(`Relatório MD:   ${arquivos.md}`);
}

main().catch((err) => {
  console.error('Erro na POC:', err instanceof Error ? err.message : err);
  process.exit(1);
});
