# Status do Projeto — Sistema de Candidatura a Vagas

**Última atualização:** 2026-10-06  
<<<<<<< HEAD
**Branch ativa:** `feat/f8-poc-latencia-voz`  
**PR:** Fase 1 concluída na `main`; POC 8.1 em andamento

## Status geral

🟢 **Fase 1 concluída** na `main` — monorepo, CI, Docker e esqueletos.  
🟡 **POC 8.1 em andamento** — latência de voz (`feat/f8-poc-latencia-voz`).
=======
**Branch ativa:** `feat/f2-modelo-de-dados`  
**PR:** Fase 2 em implementação

## Status geral

🟡 **Fase 2 em andamento** — modelo de dados completo, RLS, seeds e testes de isolamento.

## Decisões do Renato (registro)

| Decisão | Status |
|---------|--------|
| Sem Sentry por enquanto | ✅ Registrado |
| Execução 100% local na máquina do agente até finalizar todas as fases | ✅ Registrado |
| F1-10 (nuvem/Sentry/proteger main) | ⏸️ **ADIADA** |
| F1-11 (Uazapi credenciais + número teste +55 11 95688-0691) | ✅ Concluída — **tokens não ficam no repo** |
>>>>>>> c45bfdd (feat(prisma): implementa Fase 2 — modelo de dados, RLS e seeds)

## Fases de implementação

| Fase | Objetivo | Status |
|:----:|----------|:------:|
| 1 | Setup do repo e ambientes | ✅ Concluída |
<<<<<<< HEAD
| 2 | Modelo de dados | ⬜ Pendente |
=======
| 2 | Modelo de dados | 🟡 Em andamento |
>>>>>>> c45bfdd (feat(prisma): implementa Fase 2 — modelo de dados, RLS e seeds)
| 3 | Auth e papéis | ⬜ Pendente |
| 4 | CRUD de vagas | ⬜ Pendente |
| 5 | Perfil do candidato com OCR | ⬜ Pendente |
| 6 | Candidatura e notificações | ⬜ Pendente |
| 7 | Entrevista WhatsApp (Uazapi) | ⬜ Pendente |
| 8 | Entrevista IA por voz | ⬜ Pendente |
| 9 | Ranqueamento | ⬜ Pendente |
| 10 | Multiprocesso | ⬜ Pendente |

## POCs e trabalho paralelo

| ID | Item | Status | Branch | Documentação |
|----|------|--------|--------|--------------|
| 8.1 | POC de latência de voz | 🟡 Em andamento | `feat/f8-poc-latencia-voz` | [docs/pocs/voz-latencia.md](./pocs/voz-latencia.md) |

A POC 8.1 pode começar após a Fase 1 (conforme plano §7.1) e roda em paralelo às demais fases. Não altera o progresso das fases principais acima.

### Artefatos da POC 8.1

- `apps/voice-agent/` — script de medição STT → LLM → TTS (`pnpm --filter @scv/voice-agent poc:mock`)
- `docs/pocs/voz-latencia.md` — metas, pipeline, instruções e tabela de resultados

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
| F1-10 | Contas de nuvem/GitHub/Sentry; proteger a `main` | ⏸️ Adiada | **Renato** |
| F1-11 | Conta Uazapi e número de teste | ✅ Feito (credenciais fora do repo) | Renato |

## Checklist Fase 2

| ID | Tarefa | Status | Responsável |
|----|--------|:------:|-------------|
| F2-01 | ADR multi-tenant (`empresaId` + RLS + bypass admin MFA) | ✅ Feito | Cursor |
| F2-02 | **Aprovar ADR multi-tenant** | ⏳ **Aguarda Renato** | **Renato** |
| F2-03 | Schema `identidade` | ✅ Feito | Cursor |
| F2-04 | Schema `vagas` (prazo, pausa, pesos, tempos, retry) | ✅ Feito | Cursor |
| F2-05 | Schema `candidatos` (LinkedIn, CV, consentimentos) | ✅ Feito | Cursor |
| F2-06 | Schema `entrevistas` (Resposta áudio/transcrição, InstanciaWhatsapp, Score) | ✅ Feito | Cursor |
| F2-07 | Schema `notificacoes` (Notificacao, Preferencia, Push, Match) | ✅ Feito | Cursor |
| F2-08 | Políticas RLS + extensão Prisma tenant + bypass admin | ✅ Feito | Cursor |
| F2-09 | Seeds (habilidades, empresas todos estados, usuários todos papéis) | ✅ Feito | Cursor |
| F2-10 | Testes de migração e isolamento RLS | ✅ Feito | Cursor |
| F2-11 | Diagrama ER em `docs/` | ✅ Feito | Cursor |

## Documentos de referência

- [Plano Técnico e de Produto](plano-sistema.md)
- [Plano de Implementação Orquestrado](plano-implementacao.md)
- [ADR 0001 — Contexto inicial](adr/0001-contexto-inicial.md)
- [ADR 0002 — Multi-tenant (aguarda aprovação Renato)](adr/0002-multi-tenant.md)
- [Diagrama ER Fase 2](diagrama-er-fase2.md)
- [Proteção da branch main](protecao-branch-main.md)
- [AGENTS.md](../AGENTS.md)

## Como validar localmente

```bash
# 1. Dependências e qualidade
pnpm install
pnpm lint && pnpm typecheck && pnpm test && pnpm build

# 2. Infra local (Postgres + pgvector)
docker compose -f infra/docker-compose.yml up -d postgres

# 3. Banco — migrações e seeds
export DATABASE_URL=postgresql://scv:scv_dev_password@localhost:5432/scv?schema=public
pnpm --filter @scv/prisma db:generate
pnpm --filter @scv/prisma db:migrate:deploy
pnpm --filter @scv/prisma db:seed

<<<<<<< HEAD
# 4. Workers
pnpm --filter @scv/workers dev
# GET http://localhost:3001/health
# Bull Board: http://localhost:3001/admin/queues

# 5. Mobile
pnpm --filter @scv/mobile dev

# 6. POC 8.1 — latência de voz (modo mock, sem APIs)
pnpm --filter @scv/voice-agent gerar-fixture
pnpm --filter @scv/voice-agent poc:mock
=======
# 4. Testes de migração e isolamento RLS
pnpm --filter @scv/prisma test
>>>>>>> c45bfdd (feat(prisma): implementa Fase 2 — modelo de dados, RLS e seeds)
```
