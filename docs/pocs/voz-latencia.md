# POC 8.1 — Latência de voz em tempo real

**Status:** em andamento  
**Branch:** `feat/f8-poc-latencia-voz`  
**Referência:** [plano de implementação §7.10 (F8-01)](../plano-implementacao.md), [orçamento §8.6.3](../plano-sistema.md)

## Objetivo

Medir a latência de ponta a ponta de **um turno de voz** (candidato fala → IA responde por áudio), comparando tempos por etapa contra o orçamento de **< ~1 s de resposta percebida** (p50).

Esta POC **não integra** o app mobile nem LiveKit — foca no pipeline de processamento e na instrumentação.

## Pipeline escolhido

| Opção | Decisão POC | Justificativa |
|-------|-------------|---------------|
| **STT → LLM → TTS** (modular) | ✅ Escolhido | Alinha com `SttProvider` / `LlmProvider` do monorepo; permite medir cada etapa; suporta componentes locais (Ollama) e gerenciados (OpenAI); streaming no LLM. |
| Speech-to-speech (ex.: Realtime API) | ⏳ Fase seguinte | Menor latência potencial, mas caixa-preta — difícil decompor métricas; será comparado na F8-02 após esta baseline. |
| LiveKit / WebRTC | ⏳ Fora do escopo 8.1 | Transporte de mídia adiciona ~50–150 ms de rede; POC isola o pipeline de IA. Integração na F8-03+. |

### Modos de execução

| Modo | STT | LLM | TTS | Uso |
|------|-----|-----|-----|-----|
| `mock` | simulado | simulado | simulado | CI, validação do script, sem custo |
| `openai` | Whisper API | GPT streaming | TTS API | Baseline gerenciada, pt-BR |
| `hibrido` | Whisper API | Ollama local | TTS API | Reduz latência/custo do LLM |

## Metas estimadas (orçamento §8.6.3)

| Etapa | Meta (ms) | Observação |
|-------|-----------|------------|
| VAD / fim de turno | 200–300 | Simulado na POC; real virá com WebRTC + agente |
| STT (após fim da fala) | 100–200 | Whisper streaming ou batch |
| LLM (1º token) | 250–400 | Streaming obrigatório |
| TTS (1º áudio) | 100–200 | Preferir streaming na Fase 8 |
| Rede / transporte | 50–150 | Não medido nesta POC (sem WebRTC) |
| **Total percebido** | **< ~1000** | Soma das etapas acima |

## Como rodar localmente

### 1. Instalar dependências (raiz do monorepo)

```bash
pnpm install
pnpm --filter @scv/voice-agent gerar-fixture
```

### 2. Modo mock (sem APIs)

```bash
pnpm --filter @scv/voice-agent poc:mock
```

### 3. Modo OpenAI (STT + LLM + TTS)

```bash
cp apps/voice-agent/.env.example apps/voice-agent/.env
# Defina OPENAI_API_KEY no .env
POC_MODO=openai pnpm --filter @scv/voice-agent poc
```

### 4. Modo híbrido (LLM local via Ollama)

```bash
# Terminal 1: ollama serve && ollama pull llama3.2
POC_MODO=hibrido pnpm --filter @scv/voice-agent poc
```

### 5. Saída

Relatórios em `apps/voice-agent/relatorios/`:

- `latencia-<timestamp>.json` — métricas estruturadas
- `latencia-<timestamp>.md` — tabela legível

Também é impresso no stdout.

### Variáveis de ambiente

Documentadas em [`apps/voice-agent/.env.example`](../../apps/voice-agent/.env.example). **Nunca commitar secrets.**

| Variável | Descrição |
|----------|-----------|
| `POC_MODO` | `mock` \| `openai` \| `hibrido` |
| `OPENAI_API_KEY` | Chave para STT/LLM/TTS (modos openai/hibrido) |
| `OLLAMA_BASE_URL` | URL do Ollama (modo hibrido) |
| `POC_AUDIO_FIXTURE` | Caminho do WAV de entrada |

## Tabela de resultados

> Preencher após rodadas em ambiente real. Valores abaixo são **placeholder** da execução mock.

| Data | Modo | VAD (ms) | STT (ms) | LLM TTFT (ms) | TTS 1º áudio (ms) | Total percebido (ms) | Meta <1s | Notas |
|------|------|----------|----------|---------------|-------------------|----------------------|----------|-------|
| _pendente_ | mock | ~220 | ~140 | ~320 | ~160 | ~840 | ✅ | Simulação local, sem rede |
| _pendente_ | openai | — | — | — | — | — | — | Rodar com `OPENAI_API_KEY` |
| _pendente_ | hibrido | — | — | — | — | — | — | Ollama + OpenAI STT/TTS |
| _pendente_ | speech-to-speech | — | — | — | — | — | — | Comparativo F8-02 |

### Próximos passos (fora do escopo 8.1)

1. Rodar N≥30 iterações por modo e calcular **p50/p95** por etapa.
2. Comparar speech-to-speech (OpenAI Realtime ou similar).
3. Adicionar LiveKit loopback e medir rede/transporte.
4. ADR Q3 com base nos dados (`docs/adr/`).

## Estrutura do código

```text
apps/voice-agent/
  src/
    poc-latencia.ts      # entrypoint
    providers/           # STT, LLM, TTS
    report.ts            # JSON + Markdown
  fixtures/              # áudio de entrada
  relatorios/            # saída (gitignored)
```
