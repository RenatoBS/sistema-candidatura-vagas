# Sistema de Candidatura a Vagas

Plataforma de recrutamento com IA em um **único app React Native**, com três visões conforme o papel do usuário:

- **Empresa**: auto-cadastro com verificação, conexão do próprio WhatsApp, vagas com prazo de inscrições obrigatório, processo seletivo com perguntas próprias ou sugeridas por IA e ranking explicável.
- **Candidato**: vagas, perfil, currículo com OCR local, link do LinkedIn, habilidades e acompanhamento do status das candidaturas.
- **Admin da plataforma**: acesso total, com MFA e auditoria.

O processo seletivo tem duas fases, ambas com tentativa única e revisão humana:

1. **Triagem pelo WhatsApp**: o bot envia as perguntas por texto, pelo número da empresa (Uazapi), e o candidato responde por áudio. O áudio é transcrito e avaliado pela IA, com retry automático para quem não respondeu.
2. **Entrevista por voz em tempo real com IA**, no app, com limite de tempo por pergunta.

O sistema é multi-tenant e suporta vários processos seletivos simultâneos.

**Status:** 🟢 **Fase 3 em revisão** (auth, papéis, verificação de empresa e WhatsApp) — veja o [status detalhado](docs/STATUS.md). O ADR de CNPJ e revisão manual ainda é provisório.

## Stack

| Camada | Tecnologia |
|--------|------------|
| App | React Native (Expo + Expo Router), app único com visões candidato, empresa e admin |
| Backend | Node.js + NestJS (TypeScript) |
| Workers | BullMQ + Redis |
| Dados | PostgreSQL + pgvector, via Prisma |
| Assíncrono | Redis + BullMQ |
| Arquivos | Armazenamento S3-compatível (MinIO em dev) |
| OCR | Tesseract local |
| WhatsApp | Uazapi, com uma instância (número) por empresa |
| Voz em tempo real | WebRTC com LiveKit |
| IA | Whisper para a 1ª fase e LLM via camada de abstração |

## Início rápido

```bash
# Instalar dependências
pnpm install

# Qualidade
pnpm lint && pnpm typecheck && pnpm test && pnpm build

# Infra local (Postgres, Redis, MinIO, LiveKit, Mailpit)
cp .env.example .env
docker compose -f infra/docker-compose.yml up -d

# API (http://localhost:3000/api/v1/health)
pnpm --filter @scv/api dev

# Workers + Bull Board (http://localhost:3001/admin/queues)
pnpm --filter @scv/workers dev

# App mobile
pnpm --filter @scv/mobile dev
```

## Estrutura do monorepo

```text
apps/
  api/           # NestJS REST
  workers/       # BullMQ
  voice-agent/   # Agente de voz (stub)
  mobile/        # Expo Router
packages/
  contracts/     # OpenAPI, Zod, tipos
  domain/        # Regras puras
  providers/     # Adapters externos
  config/        # ESLint, TS, Prettier
prisma/schema/   # Schema Prisma
infra/           # Docker Compose, Terraform
docs/            # Planos, ADRs, briefs, STATUS
```

## Documentos

- [**Status do projeto**](docs/STATUS.md) — fases, checklist F1, como validar.
- [Plano Técnico e de Produto](docs/plano-sistema.md): requisitos, arquitetura, modelo de dados, fluxos.
- [Plano de Implementação Orquestrado](docs/plano-implementacao.md): 10 fases, tarefas, paralelismo.
- [AGENTS.md](AGENTS.md): guia para agentes de IA.
- [Diagramas renderizados (PNG)](docs/diagramas/): versões estáticas dos diagramas Mermaid.

## Agentes de IA

Este projeto é desenvolvido por Claude Code, Codex e Cursor sob orquestração do Renato. Leia [AGENTS.md](AGENTS.md) antes de contribuir.
