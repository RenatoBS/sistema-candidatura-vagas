import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import type { EtapaLatencia, PocModo, RelatorioLatencia, ResultadoTurno } from './types';

const ORCAMENTO = {
  vadTurnoMs: [200, 300] as [number, number],
  sttMs: [100, 200] as [number, number],
  llmPrimeiroTokenMs: [250, 400] as [number, number],
  ttsPrimeiroAudioMs: [100, 200] as [number, number],
  redeMs: [50, 150] as [number, number],
  totalPercebidoMs: 1000,
};

export function montarRelatorio(params: {
  modo: PocModo;
  pipeline: string;
  fixtureAudio: string;
  etapas: EtapaLatencia[];
  vadTurnoMs: number;
  sttMs: number;
  llmPrimeiroTokenMs: number;
  llmTotalMs: number;
  ttsPrimeiroAudioMs: number;
  ttsTotalMs: number;
  e2eMs: number;
  resultado: ResultadoTurno;
}): RelatorioLatencia {
  const redeEstimadaMs = Math.round(params.e2eMs * 0.08);
  const totalPercebidoMs =
    params.vadTurnoMs + params.sttMs + params.llmPrimeiroTokenMs + params.ttsPrimeiroAudioMs + redeEstimadaMs;

  return {
    meta: {
      versao: '0.1.0-poc',
      timestamp: new Date().toISOString(),
      modo: params.modo,
      pipeline: params.pipeline,
      fixtureAudio: params.fixtureAudio,
    },
    orcamento: ORCAMENTO,
    etapas: params.etapas,
    metricas: {
      vadTurnoMs: params.vadTurnoMs,
      sttMs: params.sttMs,
      llmPrimeiroTokenMs: params.llmPrimeiroTokenMs,
      llmTotalMs: params.llmTotalMs,
      ttsPrimeiroAudioMs: params.ttsPrimeiroAudioMs,
      ttsTotalMs: params.ttsTotalMs,
      redeEstimadaMs,
      totalPercebidoMs: Math.round(totalPercebidoMs),
      e2eMs: Math.round(params.e2eMs),
    },
    resultado: params.resultado,
  };
}

function statusMeta(valor: number, [min, max]: [number, number]): string {
  if (valor <= max) return '✅';
  if (valor <= max * 1.5) return '⚠️';
  return '❌';
}

export function relatorioParaMarkdown(relatorio: RelatorioLatencia): string {
  const m = relatorio.metricas;
  const o = relatorio.orcamento;

  return `# Relatório de latência — turno de voz

| Campo | Valor |
|-------|-------|
| Timestamp | ${relatorio.meta.timestamp} |
| Modo | \`${relatorio.meta.modo}\` |
| Pipeline | ${relatorio.meta.pipeline} |
| Fixture | \`${relatorio.meta.fixtureAudio}\` |

## Métricas vs orçamento (plano §8.6.3)

| Etapa | Medido (ms) | Meta (ms) | Status |
|-------|-------------|-----------|--------|
| VAD / fim de turno | ${m.vadTurnoMs} | ${o.vadTurnoMs[0]}–${o.vadTurnoMs[1]} | ${statusMeta(m.vadTurnoMs, o.vadTurnoMs)} |
| STT | ${m.sttMs.toFixed(1)} | ${o.sttMs[0]}–${o.sttMs[1]} | ${statusMeta(m.sttMs, o.sttMs)} |
| LLM (1º token) | ${m.llmPrimeiroTokenMs.toFixed(1)} | ${o.llmPrimeiroTokenMs[0]}–${o.llmPrimeiroTokenMs[1]} | ${statusMeta(m.llmPrimeiroTokenMs, o.llmPrimeiroTokenMs)} |
| TTS (1º áudio) | ${m.ttsPrimeiroAudioMs.toFixed(1)} | ${o.ttsPrimeiroAudioMs[0]}–${o.ttsPrimeiroAudioMs[1]} | ${statusMeta(m.ttsPrimeiroAudioMs, o.ttsPrimeiroAudioMs)} |
| Rede (estimada) | ${m.redeEstimadaMs} | ${o.redeMs[0]}–${o.redeMs[1]} | ${statusMeta(m.redeEstimadaMs, o.redeMs)} |
| **Total percebido** | **${m.totalPercebidoMs}** | **< ${o.totalPercebidoMs}** | ${m.totalPercebidoMs < o.totalPercebidoMs ? '✅' : '❌'} |
| E2E (wall-clock) | ${m.e2eMs} | — | — |

## Resultado do turno

- **Transcrição:** ${relatorio.resultado.transcricao}
- **Resposta LLM:** ${relatorio.resultado.respostaLlm}
- **Áudio de resposta:** ${relatorio.resultado.audioRespostaBytes ?? 0} bytes

## Etapas (cronologia)

${relatorio.etapas
  .map((e) => `- \`${e.etapa}\`: ${e.duracaoMs.toFixed(1)} ms${e.detalhe ? ` — ${e.detalhe}` : ''}`)
  .join('\n')}
`;
}

export function salvarRelatorio(relatorio: RelatorioLatencia, diretorioSaida: string): { json: string; md: string } {
  mkdirSync(diretorioSaida, { recursive: true });
  const stamp = relatorio.meta.timestamp.replace(/[:.]/g, '-');
  const jsonPath = path.resolve(diretorioSaida, `latencia-${stamp}.json`);
  const mdPath = path.resolve(diretorioSaida, `latencia-${stamp}.md`);

  writeFileSync(jsonPath, JSON.stringify(relatorio, null, 2), 'utf-8');
  writeFileSync(mdPath, relatorioParaMarkdown(relatorio), 'utf-8');

  return { json: jsonPath, md: mdPath };
}
