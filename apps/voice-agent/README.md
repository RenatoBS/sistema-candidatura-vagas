# @scv/voice-agent

Agente de voz da 2ª fase (stub) + **POC 8.1** de latência STT → LLM → TTS.

Documentação completa: [docs/pocs/voz-latencia.md](../../docs/pocs/voz-latencia.md).

## Uso (monorepo pnpm)

```bash
# Na raiz do repositório
pnpm install
pnpm --filter @scv/voice-agent gerar-fixture
pnpm --filter @scv/voice-agent poc:mock
```

Com OpenAI (na raiz ou em `apps/voice-agent/.env`):

```bash
POC_MODO=openai pnpm --filter @scv/voice-agent poc
```

## Scripts

| Script | Descrição |
|--------|-----------|
| `dev` | Stub do agente (Fase 8) |
| `poc` / `poc:mock` | Medição de latência do turno de voz |
| `gerar-fixture` | Gera `fixtures/pergunta-candidato.wav` |
| `lint` / `typecheck` / `test` / `build` | Integrados ao Turborepo na CI |

Relatórios em `relatorios/` (gitignored).
