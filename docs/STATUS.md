# Status do Projeto — Sistema de Candidatura a Vagas

**Última atualização:** 2026-10-06  
**Branch ativa:** `feat/f1-setup-monorepo`  
**PR:** Fase 1 em implementação — revisada pelo Claude Code em 2026-10-06

## Status geral

🟡 **Fase 1 em andamento** — setup do monorepo, CI, Docker e esqueletos das aplicações.

## Fases de implementação

| Fase | Objetivo | Status |
|:----:|----------|:------:|
| 1 | Setup do repo e ambientes | 🟡 Em andamento |
| 2 | Modelo de dados | ⬜ Pendente |
| 3 | Auth e papéis | ⬜ Pendente |
| 4 | CRUD de vagas | ⬜ Pendente |
| 5 | Perfil do candidato com OCR | ⬜ Pendente |
| 6 | Candidatura e notificações | ⬜ Pendente |
| 7 | Entrevista WhatsApp (Uazapi) | ⬜ Pendente |
| 8 | Entrevista IA por voz | ⬜ Pendente |
| 9 | Ranqueamento | ⬜ Pendente |
| 10 | Multiprocesso | ⬜ Pendente |

## Checklist Fase 1

| ID | Tarefa | Status | Responsável |
|----|--------|:------:|-------------|
| F1-01 | Monorepo pnpm + Turborepo, TS/ESLint/Prettier, estrutura §4.1 | ✅ Feito | Cursor |
| F1-02 | AGENTS.md, CLAUDE.md, templates PR/brief, ADR 0001 | ✅ Feito | Cursor |
| F1-03 | .cursor/rules (UI, rotas, Composer/Grok) | ✅ Feito | Cursor |
| F1-04 | docker-compose (Postgres+pgvector, Redis, MinIO, LiveKit, Mailpit), .env.example | ✅ Feito | Cursor |
| F1-05 | CI GitHub Actions (lint, typecheck, testes, migrações, build, gitleaks) | ✅ Feito | Cursor |
| F1-06 | Esqueleto NestJS (health, config, pino, OTel) + workers BullMQ + Bull Board | ✅ Feito | Cursor |
| F1-07 | Esqueleto Expo Router (providers, design system, i18n pt-BR, tela inicial) | ✅ Feito | Cursor |
| F1-08 | IaC base (Terraform esqueleto dev/staging, cofre de segredos placeholder) | ✅ Feito | Cursor |
| F1-09 | Dependabot, CODEOWNERS, docs proteção da main | ✅ Feito | Cursor |
| F1-10 | Contas de nuvem/GitHub/Sentry; proteger a `main` | ⬜ Pendente | **Renato** |
| F1-11 | Conta Uazapi e número de teste | ✅ Feito (credenciais + número +55 11 95688-0691) | Renato + HubCandidate |

## Revisão cruzada Fase 1 — Claude Code (2026-10-06)

Revisão de arquitetura de F1-01 a F1-09 feita pelo Claude Code (Opus 5.5). `pnpm install && pnpm lint && pnpm typecheck && pnpm test && pnpm build` verdes localmente; `GET /api/v1/health` respondendo `200` com o build de produção.

**Ajustes feitos:**

- `.gitignore`: removido o ignore de `prisma/schema/migrations/` — migrações precisam ser versionadas (pré-requisito da Fase 2).
- `infra/docker-compose.yml`: healthcheck do MinIO trocado de `curl` (ausente na imagem oficial) para `mc ready local`.
- `apps/workers`: `@types/express` alinhado à major do `express` (v4).
- `apps/mobile/turbo.json`: `build` sem outputs (só valida tipos/entrypoint), eliminando o aviso do Turborepo.

**Pendências registradas (não bloqueiam a Fase 1):**

- **CI (aplicar pelo Renato):** remover `with: version: 10` dos 3 passos `pnpm/action-setup@v4` em `.github/workflows/ci.yml` — conflita com `packageManager` e a action falha. O agente não tem escopo `workflow` no token para enviar essa mudança.
- `docker compose up` não validado neste ambiente (sem daemon Docker); validar localmente.
- `apps/api/test` fica fora do `typecheck`; `dist/` dos `packages/*` inclui arquivos `*.test.*`.
- Compose lê `.env` de `infra/`; para usar o `.env` da raiz, rodar com `--env-file .env`.
- Prisma multi-arquivo (Fase 2): scripts devem apontar para a pasta `schema/` em vez de `schema/schema.prisma`.
- `pnpm format:check` acusa 8 arquivos Markdown (não roda na CI).

## Documentos de referência

- [Plano Técnico e de Produto](plano-sistema.md)
- [Plano de Implementação Orquestrado](plano-implementacao.md)
- [ADR 0001 — Contexto inicial](adr/0001-contexto-inicial.md)
- [Proteção da branch main](protecao-branch-main.md)
- [AGENTS.md](../AGENTS.md)

## Como validar localmente

```bash
# 1. Dependências e qualidade
pnpm install
pnpm lint && pnpm typecheck && pnpm test && pnpm build

# 2. Infra local
docker compose -f infra/docker-compose.yml config
docker compose -f infra/docker-compose.yml up -d

# 3. API
cp .env.example .env
pnpm --filter @scv/api dev
# GET http://localhost:3000/api/v1/health

# 4. Workers
pnpm --filter @scv/workers dev
# GET http://localhost:3001/health
# Bull Board: http://localhost:3001/admin/queues

# 5. Mobile
pnpm --filter @scv/mobile dev
```
