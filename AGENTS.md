# AGENTS.md — Guia para agentes de IA

Fonte única de contexto para Claude Code, Codex e Cursor neste repositório.

## Visão do produto

Plataforma de recrutamento com IA em um **único app React Native** (Expo Router):

- **Empresa**: auto-cadastro, WhatsApp próprio (Uazapi), vagas com prazo, processo seletivo com IA.
- **Candidato**: vagas, perfil, CV com OCR local, candidaturas, status/fase (sem score).
- **Admin**: verificação de empresas, auditoria, MFA obrigatório.

Duas fases do processo seletivo: triagem WhatsApp (áudio) e entrevista por voz em tempo real (LiveKit).

## Stack

| Camada | Tecnologia |
|--------|------------|
| App | React Native (Expo + Expo Router) |
| API | NestJS (TypeScript) |
| Workers | BullMQ + Redis |
| Dados | PostgreSQL + pgvector, Prisma |
| Arquivos | S3-compatível (MinIO em dev) |
| OCR | Tesseract local |
| WhatsApp | Uazapi (uma instância por empresa) |
| Voz | LiveKit + agente de voz |
| IA | LLM via `LlmProvider`, STT via `SttProvider` |

## Estrutura do monorepo

```text
apps/api/          # NestJS REST + webhooks
apps/workers/      # BullMQ
apps/voice-agent/  # Agente de voz (Fase 8)
apps/mobile/       # Expo Router (candidato, empresa, admin)
packages/contracts/  # OpenAPI, Zod, tipos
packages/domain/     # Regras puras
packages/providers/  # Adapters externos
packages/config/     # ESLint, TS, Prettier
prisma/schema/       # Schema dividido por domínio
infra/               # Docker Compose, Terraform
docs/                # Planos, ADRs, briefs, STATUS
```

## Comandos

```bash
pnpm install          # Instalar dependências
pnpm dev              # Subir apps em modo dev (paralelo)
pnpm lint             # ESLint em todos os pacotes
pnpm typecheck        # Verificação de tipos
pnpm test             # Testes
pnpm build            # Build de produção

# Infra local
docker compose -f infra/docker-compose.yml up -d

# API
pnpm --filter @scv/api dev        # http://localhost:3000/api/v1/health
pnpm --filter @scv/workers dev    # http://localhost:3001/health + Bull Board

# Mobile
pnpm --filter @scv/mobile dev
```

## Convenções

- Branches: `feat/f<fase>-<id>-<descricao>` (ex.: `feat/f7-06-retry-triagem`).
- Commits: Conventional Commits em **pt-BR**.
- PR: o que muda, como testar, critérios de aceite, riscos, agente autor e modelo.
- **Cursor**: usar sempre **Composer ou Grok** (nunca modelos de terceiros).

## Regras de multi-tenant

- Toda query de tabela com `empresaId` passa pelo **contexto de tenant**.
- Bypass de isolamento **somente** para `ADMIN_PLATAFORMA` com MFA, auditado.
- Testes de acesso cruzado são obrigatórios na CI (Fase 2+).

## Regras de ranking

- **DTO do candidato nunca expõe score**, posição, percentil ou total de candidatos.
- Teste automatizado de ranking invisível na CI (Fase 9).

## Proibições

- **Nunca** commitar segredos (`.env`, tokens, chaves).
- **Nunca** fazer merge em `main` (somente Renato).
- **Nunca** alterar migrações já aplicadas em produção.
- **Nunca** usar credenciais de produção.
- **Nunca** incluir PII em logs ou fixtures.

## Definição de pronto

- Critérios de aceite do brief atendidos.
- Testes adicionados para comportamento novo.
- OpenAPI e tipos atualizados quando a API muda.
- CI verde: lint, typecheck, testes, build, varredura de segredos.
- Sem segredos e sem PII em logs.

## Documentos de referência

- [Plano do sistema](docs/plano-sistema.md)
- [Plano de implementação](docs/plano-implementacao.md)
- [Status do projeto](docs/STATUS.md)
- [ADRs](docs/adr/)

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
