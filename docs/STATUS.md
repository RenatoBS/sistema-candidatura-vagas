# Status do Projeto — Sistema de Candidatura a Vagas

**Última atualização:** 2026-10-06  
**Branch ativa:** `cursor/fase-3-auth-papeis-e8d4`  
**PR:** [#8 — Fase 3 auth e papéis](https://github.com/RenatoBS/sistema-candidatura-vagas/pull/8)

## Status geral

🟢 **Fase 1 concluída** na `main` — monorepo, CI, Docker e esqueletos.  
✅ **Fase 2 concluída** — modelo de dados, RLS, seeds, testes de isolamento e ADR multi-tenant aprovado.  
🟢 **Fase 3 implementada** nesta branch — auth, RBAC, MFA, verificação de empresa, auditoria, membros e instância WhatsApp. ADR 0003 (Q5/Q6) está **provisório**, aguardando o Renato.  
🟢 **POC 8.1 concluída** na `main` (squash `9db00ec`) — latência de voz STT→LLM→TTS.

## Decisões do Renato (registro)

| Decisão | Status |
|---------|--------|
| Sem Sentry por enquanto | ✅ Registrado |
| Execução 100% local na máquina do agente até finalizar todas as fases | ✅ Registrado |
| F1-10 (nuvem/Sentry/proteger main) | ⏸️ **ADIADA** |
| F1-11 (Uazapi credenciais + número teste +55 11 95688-0691) | ✅ Concluída — **tokens não ficam no repo** |

## Fases de implementação

| Fase | Objetivo | Status |
|:----:|----------|:------:|
| 1 | Setup do repo e ambientes | ✅ Concluída |
| 2 | Modelo de dados | ✅ Concluída |
| 3 | Auth e papéis | 🟢 Em revisão (ADR 0003 provisório) |
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
| 8.1 | POC de latência de voz | ✅ Concluída (`main`) | mergeada | [docs/pocs/voz-latencia.md](./pocs/voz-latencia.md) |

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
| F2-02 | Aprovar ADR multi-tenant | ✅ Aprovado (2026-10-06) | Renato |
| F2-03 | Schema `identidade` | ✅ Feito | Cursor |
| F2-04 | Schema `vagas` (prazo, pausa, pesos, tempos, retry) | ✅ Feito | Cursor |
| F2-05 | Schema `candidatos` (LinkedIn, CV, consentimentos) | ✅ Feito | Cursor |
| F2-06 | Schema `entrevistas` (Resposta áudio/transcrição, InstanciaWhatsapp, Score) | ✅ Feito | Cursor |
| F2-07 | Schema `notificacoes` (Notificacao, Preferencia, Push, Match) | ✅ Feito | Cursor |
| F2-08 | Políticas RLS + extensão Prisma tenant + bypass admin | ✅ Feito | Cursor |
| F2-09 | Seeds (habilidades, empresas todos estados, usuários todos papéis) | ✅ Feito | Cursor |
| F2-10 | Testes de migração e isolamento RLS | ✅ Feito | Cursor |
| F2-11 | Diagrama ER em `docs/` | ✅ Feito | Cursor |

## Checklist Fase 3

| ID | Tarefa | Status | Responsável |
|----|--------|:------:|-------------|
| F3-01 | Fonte de CNPJ e política de revisão manual | 🟡 Provisório (ADR 0003, revisável pelo Renato) | Orquestrador |
| F3-02 | Auth core (cadastro, login, refresh rotativo, logout, recuperação, confirmação de e-mail, `GET /me`) | ✅ Feito | Cursor |
| F3-03 | RBAC e matriz de permissões como código | ✅ Feito | Cursor |
| F3-04 | MFA TOTP obrigatório para admin, códigos de recuperação e reauth | ✅ Feito | Cursor |
| F3-05 | Auto-cadastro de empresa + e-mail/domínio | ✅ Feito | Cursor |
| F3-06 | Validação de CNPJ (dígitos locais + BrasilAPI + job BullMQ) | ✅ Feito | Cursor |
| F3-07 | Estados da empresa, fila de revisão e bloqueio de publicação | ✅ Feito | Cursor |
| F3-08 | Auditoria append-only e acesso a áudio/transcrição | ✅ Feito | Cursor |
| F3-09 | Telas de auth, MFA, onboarding e status da empresa | ✅ Feito | Cursor |
| F3-10 | Grupos `(candidato)`, `(empresa)`, `(admin)`, troca de visão, `usePermissao` | ✅ Feito | Cursor |
| F3-11 | Telas do admin (fila, empresas, auditoria) | ✅ Feito | Cursor |
| F3-12 | Convite de recrutador/avaliador (sem convite de empresa) | ✅ Feito | Cursor |
| F3-13 | Suíte da matriz de permissões e bypass auditado | ✅ Feito | Cursor |
| F3-14 | Adapter Uazapi de instâncias, token cifrado, `/empresas/{id}/whatsapp/*` | ✅ Feito | Cursor |
| F3-15 | Etapa Conectar WhatsApp (QR, status, banner, visão admin) | ✅ Feito | Cursor |

## Documentos de referência

- [Plano Técnico e de Produto](plano-sistema.md)
- [Plano de Implementação Orquestrado](plano-implementacao.md)
- [ADR 0001 — Contexto inicial](adr/0001-contexto-inicial.md)
- [ADR 0002 — Multi-tenant (aceito)](adr/0002-multi-tenant.md)
- [ADR 0003 — CNPJ e revisão de empresa (provisório)](adr/0003-verificacao-empresa.md)
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

# 4. Testes de migração e isolamento RLS
pnpm --filter @scv/prisma test

# 5. Workers
pnpm --filter @scv/workers dev
# GET http://localhost:3001/health
# Bull Board: http://localhost:3001/admin/queues

# 6. API (auth em memória nos testes; com Postgres use AUTH_STORE=prisma)
# Variáveis: JWT_SECRET, APP_ENCRYPTION_KEY, REVISAO_MANUAL_EMPRESA, INTERNAL_JOB_TOKEN, API_PUBLIC_URL
# E-mail: sem SMTP_HOST o adapter só registra a mensagem; com Mailpit use SMTP_HOST=localhost e SMTP_PORT=1025
pnpm --filter @scv/api dev

# 7. Mobile
pnpm --filter @scv/mobile dev

# 8. POC 8.1 — latência de voz (modo mock, sem APIs)
pnpm --filter @scv/voice-agent gerar-fixture
pnpm --filter @scv/voice-agent poc:mock
```
