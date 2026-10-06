#!/usr/bin/env node
/**
 * Gera fixtures/pergunta-candidato.wav — áudio sintético de ~3s (tom + silêncio).
 * Para testes reais de STT, substitua por gravação em português ou use TTS externo.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const OUT = path.join(__dirname, '../../fixtures/pergunta-candidato.wav');

const SAMPLE_RATE = 16000;
const DURATION_S = 3;
const FREQUENCY = 440;

function gerarWavPcm16(samples: Int16Array): Buffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = SAMPLE_RATE * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < samples.length; i++) {
    buffer.writeInt16LE(samples[i], 44 + i * 2);
  }

  return buffer;
}

function gerarSamples(): Int16Array {
  const total = SAMPLE_RATE * DURATION_S;
  const samples = new Int16Array(total);
  const fadeSamples = SAMPLE_RATE * 0.05;

  for (let i = 0; i < total; i++) {
    const t = i / SAMPLE_RATE;
    let amp = 0.25 * Math.sin(2 * Math.PI * FREQUENCY * t);
    if (i < fadeSamples) amp *= i / fadeSamples;
    if (i > total - fadeSamples) amp *= (total - i) / fadeSamples;
    samples[i] = Math.round(amp * 32767);
  }

  return samples;
}

mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, gerarWavPcm16(gerarSamples()));
console.log(`Fixture gerado: ${OUT} (${DURATION_S}s, ${SAMPLE_RATE}Hz)`);
