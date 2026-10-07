# Status do Projeto — Sistema de Candidatura a Vagas

**Última atualização:** 2026-10-07  
**Branch ativa:** `feat/f10-multiprocesso`  
**PR:** Fases 7, 8 e 9 na `main` (#12, #13, #14). Fase 10 em `feat/f10-multiprocesso`.

## Status geral

🟢 **Fase 1 concluída** na `main` — monorepo, CI, Docker e esqueletos.  
✅ **Fase 2 concluída** — modelo de dados, RLS, seeds, testes de isolamento e ADR multi-tenant aprovado.  
🟢 **Fases 1–5 concluídas** na `main` — Fases 3, 4 e 5 mergeadas nos PRs [#8](https://github.com/RenatoBS/sistema-candidatura-vagas/pull/8), [#10](https://github.com/RenatoBS/sistema-candidatura-vagas/pull/10) e [#9](https://github.com/RenatoBS/sistema-candidatura-vagas/pull/9).  
🟢 **Fase 6 concluída** na `main` (PR [#11](https://github.com/RenatoBS/sistema-candidatura-vagas/pull/11)). ADR 0005 está provisório, aguardando o Renato.  
🟢 **Fase 7 concluída** na `main` (PR [#12](https://github.com/RenatoBS/sistema-candidatura-vagas/pull/12)). Ficam com o Renato: F7-01, F7-02 (decisão final) e F7-15. ADR 0006 continua provisório.  
🟢 **Fase 8 concluída** na `main` (PR [#13](https://github.com/RenatoBS/sistema-candidatura-vagas/pull/13)). F8-15 fica com o Renato. ADR 0007 é provisório.  
🟢 **Fase 9 concluída** na `main` (PR [#14](https://github.com/RenatoBS/sistema-candidatura-vagas/pull/14)). Q15 provisório no ADR 0008. Q16 e a aprovação de F9-01 ficam com o Renato.  
🟢 **Fase 10 implementada** na branch `feat/f10-multiprocesso`. Cotas provisórias no ADR 0009. F10-10 fica com o Renato.  
🟢 **POC 8.1 concluída** na `main` — latência de voz STT→LLM→TTS.

## Decisões do Renato (registro)

| Decisão                                                               | Status                                      |
| --------------------------------------------------------------------- | ------------------------------------------- |
| Sem Sentry por enquanto                                               | ✅ Registrado                               |
| Execução 100% local na máquina do agente até finalizar todas as fases | ✅ Registrado                               |
| F1-10 (nuvem/Sentry/proteger main)                                    | ⏸️ **ADIADA**                               |
| F1-11 (Uazapi credenciais + número teste +55 11 95688-0691)           | ✅ Concluída — **tokens não ficam no repo** |

## Fases de implementação

| Fase | Objetivo                     |         Status         |
| :--: | ---------------------------- | :--------------------: |
|  1   | Setup do repo e ambientes    |      ✅ Concluída      |
|  2   | Modelo de dados              |      ✅ Concluída      |
|  3   | Auth e papéis                | ✅ Concluída na `main` |
|  4   | CRUD de vagas                | ✅ Concluída na `main` |
|  5   | Perfil do candidato com OCR  | ✅ Concluída na `main` |
|  6   | Candidatura e notificações   | ✅ Concluída na `main` |
|  7   | Entrevista WhatsApp (Uazapi) | ✅ Concluída na `main` |
|  8   | Entrevista IA por voz        | ✅ Concluída na `main` |
|  9   | Ranqueamento                 | ✅ Concluída na `main` |
|  10  | Multiprocesso                |  🟡 Implementada na branch |

## POCs e trabalho paralelo

| ID  | Item                   | Status                | Branch   | Documentação                                        |
| --- | ---------------------- | --------------------- | -------- | --------------------------------------------------- |
| 8.1 | POC de latência de voz | ✅ Concluída (`main`) | mergeada | [docs/pocs/voz-latencia.md](./pocs/voz-latencia.md) |

A POC 8.1 pode começar após a Fase 1 (conforme plano §7.1) e roda em paralelo às demais fases. Não altera o progresso das fases principais acima.

### Artefatos da POC 8.1

- `apps/voice-agent/` — script de medição STT → LLM → TTS (`pnpm --filter @scv/voice-agent poc:mock`)
- `docs/pocs/voz-latencia.md` — metas, pipeline, instruções e tabela de resultados

## Checklist Fase 1

| ID    | Tarefa                                                                           |               Status                | Responsável |
| ----- | -------------------------------------------------------------------------------- | :---------------------------------: | ----------- |
| F1-01 | Monorepo pnpm + Turborepo, TS/ESLint/Prettier, estrutura §4.1                    |              ✅ Feito               | Cursor      |
| F1-02 | AGENTS.md, CLAUDE.md, templates PR/brief, ADR 0001                               |              ✅ Feito               | Cursor      |
| F1-03 | .cursor/rules (UI, rotas, Composer/Grok)                                         |              ✅ Feito               | Cursor      |
| F1-04 | docker-compose (Postgres+pgvector, Redis, MinIO, LiveKit, Mailpit), .env.example |              ✅ Feito               | Cursor      |
| F1-05 | CI GitHub Actions (lint, typecheck, testes, migrações, build, gitleaks)          |              ✅ Feito               | Cursor      |
| F1-06 | Esqueleto NestJS (health, config, pino, OTel) + workers BullMQ + Bull Board      |              ✅ Feito               | Cursor      |
| F1-07 | Esqueleto Expo Router (providers, design system, i18n pt-BR, tela inicial)       |              ✅ Feito               | Cursor      |
| F1-08 | IaC base (Terraform esqueleto dev/staging, cofre de segredos placeholder)        |              ✅ Feito               | Cursor      |
| F1-09 | Dependabot, CODEOWNERS, docs proteção da main                                    |              ✅ Feito               | Cursor      |
| F1-10 | Contas de nuvem/GitHub/Sentry; proteger a `main`                                 |              ⏸️ Adiada              | **Renato**  |
| F1-11 | Conta Uazapi e número de teste                                                   | ✅ Feito (credenciais fora do repo) | Renato      |

## Checklist Fase 2

| ID    | Tarefa                                                                      |          Status          | Responsável |
| ----- | --------------------------------------------------------------------------- | :----------------------: | ----------- |
| F2-01 | ADR multi-tenant (`empresaId` + RLS + bypass admin MFA)                     |         ✅ Feito         | Cursor      |
| F2-02 | Aprovar ADR multi-tenant                                                    | ✅ Aprovado (2026-10-06) | Renato      |
| F2-03 | Schema `identidade`                                                         |         ✅ Feito         | Cursor      |
| F2-04 | Schema `vagas` (prazo, pausa, pesos, tempos, retry)                         |         ✅ Feito         | Cursor      |
| F2-05 | Schema `candidatos` (LinkedIn, CV, consentimentos)                          |         ✅ Feito         | Cursor      |
| F2-06 | Schema `entrevistas` (Resposta áudio/transcrição, InstanciaWhatsapp, Score) |         ✅ Feito         | Cursor      |
| F2-07 | Schema `notificacoes` (Notificacao, Preferencia, Push, Match)               |         ✅ Feito         | Cursor      |
| F2-08 | Políticas RLS + extensão Prisma tenant + bypass admin                       |         ✅ Feito         | Cursor      |
| F2-09 | Seeds (habilidades, empresas todos estados, usuários todos papéis)          |         ✅ Feito         | Cursor      |
| F2-10 | Testes de migração e isolamento RLS                                         |         ✅ Feito         | Cursor      |
| F2-11 | Diagrama ER em `docs/`                                                      |         ✅ Feito         | Cursor      |

## Checklist Fase 3

| ID    | Tarefa                                                                                               |                     Status                      | Responsável  |
| ----- | ---------------------------------------------------------------------------------------------------- | :---------------------------------------------: | ------------ |
| F3-01 | Fonte de CNPJ e política de revisão manual                                                           | 🟡 Provisório (ADR 0003, revisável pelo Renato) | Orquestrador |
| F3-02 | Auth core (cadastro, login, refresh rotativo, logout, recuperação, confirmação de e-mail, `GET /me`) |                    ✅ Feito                     | Cursor       |
| F3-03 | RBAC e matriz de permissões como código                                                              |                    ✅ Feito                     | Cursor       |
| F3-04 | MFA TOTP obrigatório para admin, códigos de recuperação e reauth                                     |                    ✅ Feito                     | Cursor       |
| F3-05 | Auto-cadastro de empresa + e-mail/domínio                                                            |                    ✅ Feito                     | Cursor       |
| F3-06 | Validação de CNPJ (dígitos locais + BrasilAPI + job BullMQ)                                          |                    ✅ Feito                     | Cursor       |
| F3-07 | Estados da empresa, fila de revisão e bloqueio de publicação                                         |                    ✅ Feito                     | Cursor       |
| F3-08 | Auditoria append-only e acesso a áudio/transcrição                                                   |                    ✅ Feito                     | Cursor       |
| F3-09 | Telas de auth, MFA, onboarding e status da empresa                                                   |                    ✅ Feito                     | Cursor       |
| F3-10 | Grupos `(candidato)`, `(empresa)`, `(admin)`, troca de visão, `usePermissao`                         |                    ✅ Feito                     | Cursor       |
| F3-11 | Telas do admin (fila, empresas, auditoria)                                                           |                    ✅ Feito                     | Cursor       |
| F3-12 | Convite de recrutador/avaliador (sem convite de empresa)                                             |                    ✅ Feito                     | Cursor       |
| F3-13 | Suíte da matriz de permissões e bypass auditado                                                      |                    ✅ Feito                     | Cursor       |
| F3-14 | Adapter Uazapi de instâncias, token cifrado, `/empresas/{id}/whatsapp/*`                             |                    ✅ Feito                     | Cursor       |
| F3-15 | Etapa Conectar WhatsApp (QR, status, banner, visão admin)                                            |                    ✅ Feito                     | Cursor       |

## Checklist Fase 4

| ID    | Tarefa                                                            |                     Status                      | Responsável  |
| ----- | ----------------------------------------------------------------- | :---------------------------------------------: | ------------ |
| F4-01 | Contrato OpenAPI de vagas, processo, perguntas e ciclo de vida    |                    ✅ Feito                     | Cursor       |
| F4-02 | LLM e padrões provisórios de Q11–Q14                              | 🟡 Provisório (ADR 0004, revisável pelo Renato) | Orquestrador |
| F4-03 | CRUD de vaga + habilidades requeridas                             |                    ✅ Feito                     | Cursor       |
| F4-04 | Processo seletivo, tempos e política de retry                     |                    ✅ Feito                     | Cursor       |
| F4-05 | Perguntas exigidas e banco de perguntas                           |                    ✅ Feito                     | Cursor       |
| F4-06 | `LlmProvider` em `@scv/llm`, prompts versionados e sugestão       |                    ✅ Feito                     | Cursor       |
| F4-07 | Máquina de estados (publicar, prorrogar, pausar, retomar, fechar) |                    ✅ Feito                     | Cursor       |
| F4-08 | Encerramento automático (job, checagem na API, reconciliação)     |                    ✅ Feito                     | Cursor       |
| F4-09 | Eventos `VagaPausada` / `VagaRetomada` / `VagaFechada`            |                    ✅ Feito                     | Cursor       |
| F4-10 | Lista pública só com `PUBLICADA` e prazo futuro                   |                    ✅ Feito                     | Cursor       |
| F4-11 | Telas da empresa                                                  |                    ✅ Feito                     | Cursor       |
| F4-12 | Telas do candidato com prazo em Brasília                          |                    ✅ Feito                     | Cursor       |
| F4-13 | Testes do ciclo de vida                                           |                    ✅ Feito                     | Cursor       |

## Checklist Fase 5

| ID    | Tarefa                                                                           |  Status  | Responsável |
| ----- | -------------------------------------------------------------------------------- | :------: | ----------- |
| F5-01 | API de perfil e habilidades; `linkedinUrl` só formato                            | ✅ Feito | Cursor      |
| F5-02 | Upload pré-assinado, tipo/tamanho e antivírus (ClamAV opcional, mock nos testes) | ✅ Feito | Cursor      |
| F5-03 | Extração nativa de PDF com texto e DOCX                                          | ✅ Feito | Cursor      |
| F5-04 | OCR Tesseract local no worker dedicado (`por+eng`, só páginas sem texto)         | ✅ Feito | Cursor      |
| F5-05 | Extração estruturada: mock por padrão e `ExtratorEstruturadoLlm` via `@scv/llm`  | ✅ Feito | Cursor      |
| F5-06 | Consentimentos (termos, WhatsApp, áudio, gravação, IA) na API e nas telas        | ✅ Feito | Cursor      |
| F5-07 | Telas do candidato: perfil, upload, revisão, habilidades, LinkedIn, privacidade  | ✅ Feito | Cursor      |
| F5-08 | Fixtures de CV e teste de qualidade do OCR (job `ocr-tesseract` na CI)           | ✅ Feito | Cursor      |
| F5-09 | Exportação e exclusão LGPD                                                       | ✅ Feito | Cursor      |

Detalhes de execução, profiles Docker e o que ficou de fora: [fase-5-perfil-ocr.md](fase-5-perfil-ocr.md).

## Checklist Fase 6

| ID    | Tarefa                               |                   Status                   | Responsável |
| ----- | ------------------------------------ | :----------------------------------------: | ----------- |
| F6-01 | Credenciais push e decisão Q17       |                ⏸️ Pendente                 | Renato      |
| F6-02 | Máquina de estados e eventos de vaga |                  ✅ Feito                  | Claude Code |
| F6-03 | Candidatura direta e DTO sem score   |                  ✅ Feito                  | Codex       |
| F6-04 | Embeddings e jobs de match           |                  ✅ Feito                  | Claude Code |
| F6-05 | Convites de match                    |                  ✅ Feito                  | Codex       |
| F6-06 | Notificações e deduplicação          |                  ✅ Feito                  | Claude Code |
| F6-07 | Push                                 | ✅ Feito (mock; Expo condicionado à F6-01) | Codex       |
| F6-08 | E-mail opcional                      |                  ✅ Feito                  | Codex       |
| F6-09 | Central in-app e preferências        |                  ✅ Feito                  | Codex       |
| F6-10 | Telas e fluxos do candidato          |                  ✅ Feito                  | Codex       |
| F6-11 | Telas e fluxos da empresa            |                  ✅ Feito                  | Codex       |
| F6-12 | Suíte de testes de aceite            |                  ✅ Feito                  | Codex       |

## Checklist Fase 7

Plano do restante (handoff para agente Cursor): [plano-restante.md](plano-restante.md). Decisões provisórias: [ADR 0006](adr/0006-entrevista-whatsapp.md).

| ID    | Tarefa                                                                     |             Status              | Responsável    |
| ----- | -------------------------------------------------------------------------- | :-----------------------------: | -------------- |
| F7-01 | Instância Uazapi de teste em staging                                       |      ⏸️ Pendente (pulada)       | Renato         |
| F7-02 | Decidir Q2, Q7, Q8, Q19 (e Q21)                                            |    🟡 Provisório (ADR 0006)     | Renato         |
| F7-03 | `WhatsappProvider` + `UazapiProvider` (mensagens) + `FakeWhatsappProvider` |            ✅ Feito             | Codex          |
| F7-04 | Webhook com segredo, token, normalização, dedup Redis + índice único, fila |            ✅ Feito             | Codex          |
| F7-05 | Monitoramento das instâncias                                               |            ✅ Feito             | Cursor         |
| F7-06 | Orquestrador da triagem                                                    |            ✅ Feito             | Cursor         |
| F7-07 | Motor de retry                                                             |            ✅ Feito             | Cursor         |
| F7-08 | Tentativa consumida/abandono                                               |            ✅ Feito             | Codex → Cursor |
| F7-09 | Pipeline de áudio (download → S3 → ffmpeg → STT)                           |            ✅ Feito             | Codex          |
| F7-10 | Avaliação da resposta por IA                                               |            ✅ Feito             | Cursor         |
| F7-11 | Tratamentos de borda                                                       |            ✅ Feito             | Cursor         |
| F7-12 | Verificação do número + opt-in                                             |            ✅ Feito             | Cursor         |
| F7-13 | Telas da empresa (acompanhamento da triagem)                               |            ✅ Feito             | Cursor         |
| F7-14 | Testes com relógio simulado                                                |            ✅ Feito             | Cursor         |
| F7-15 | Teste ponta a ponta com número real                                        |      ⏸️ Pendente (pulada)       | Renato         |
| F7-16 | Roteamento por empresa                                                     |            ✅ Feito             | Cursor         |

## Checklist Fase 8

Decisões provisórias: [ADR 0007](adr/0007-entrevista-voz.md). Guia: [fase-8-entrevista-voz.md](fase-8-entrevista-voz.md).

| ID    | Tarefa                                                         |          Status          | Responsável |
| ----- | -------------------------------------------------------------- | :----------------------: | ----------- |
| F8-01 | POC de latência                                                |         ✅ Feito         | —           |
| F8-02 | Arquitetura de voz (Q3)                                        | 🟡 Provisório (ADR 0007) | Renato      |
| F8-03 | Token de sala e gravação (fake; sem LiveKit real)              |         ✅ Feito         | Cursor      |
| F8-04 | Agente de voz (pipeline mock; sem VAD/barge-in reais)          |         ✅ Feito         | Cursor      |
| F8-05 | Roteiro, follow-up e guardrails                                |         ✅ Feito         | Cursor      |
| F8-06 | Cronômetro, aviso e estouro sem eliminação                     |         ✅ Feito         | Cursor      |
| F8-07 | Tentativa, reconexão e vaga pausada                            |         ✅ Feito         | Cursor      |
| F8-08 | Transcrição por pergunta (no turno; sem fila separada)         |         ✅ Feito         | Cursor      |
| F8-09 | Avaliação por pergunta (mock determinístico)                   |         ✅ Feito         | Cursor      |
| F8-10 | Tela do candidato                                              |         ✅ Feito         | Cursor      |
| F8-11 | Pré-checagem e aceite                                          |         ✅ Feito         | Cursor      |
| F8-12 | Tela da empresa (gravação, transcrição, revisão)               |         ✅ Feito         | Cursor      |
| F8-13 | Carga local e fila de admissão                                 |         ✅ Feito         | Cursor      |
| F8-14 | Exceção manual auditada e runbook local                        |         ✅ Feito         | Cursor      |
| F8-15 | Provedores e chaves em staging                                 |   ⏸️ Pendente (pulada)   | Renato      |

## Checklist Fase 9

Decisões provisórias: [ADR 0008](adr/0008-ranqueamento.md). Guia: [fase-9-ranqueamento.md](fase-9-ranqueamento.md).

| ID    | Tarefa                                              |          Status          | Responsável |
| ----- | --------------------------------------------------- | :----------------------: | ----------- |
| F9-01 | Pesos e limiar (Q15); Q16                          | 🟡 Provisório (ADR 0008) | Renato      |
| F9-02 | Seis componentes de score                           |         ✅ Feito         | Cursor      |
| F9-03 | Ausência, renormalização e completude               |         ✅ Feito         | Cursor      |
| F9-04 | Pesos por vaga e tela                               |         ✅ Feito         | Cursor      |
| F9-05 | Recálculo com debounce e versão                     |         ✅ Feito         | Cursor      |
| F9-06 | Explicação e revisão humana                         |         ✅ Feito         | Cursor      |
| F9-07 | Ranking invisível ao candidato                      |         ✅ Feito         | Cursor      |
| F9-08 | Tela de ranking                                     |         ✅ Feito         | Cursor      |
| F9-09 | Relatório de viés                                   |         ✅ Feito         | Cursor      |
| F9-10 | Prompt sem atributos sensíveis                      |         ✅ Feito         | Cursor      |

## Checklist Fase 10

Decisões provisórias: [ADR 0009](adr/0009-multiprocesso.md). Guia: [fase-10-multiprocesso.md](fase-10-multiprocesso.md).

| ID     | Tarefa                                              |          Status          | Responsável |
| ------ | --------------------------------------------------- | :----------------------: | ----------- |
| F10-01 | Isolamento multi-tenant e bypass admin auditado    |         ✅ Feito         | Cursor      |
| F10-02 | Concorrência (webhook, pausa, fechamento)          |         ✅ Feito         | Cursor      |
| F10-03 | Cotas por tenant (API, IA, voz)                    |         ✅ Feito         | Cursor      |
| F10-04 | Autoscaling local (documentação)                   |         ✅ Feito         | Cursor      |
| F10-05 | Carga local (teste em memória + script k6)         |         ✅ Feito         | Cursor      |
| F10-06 | Candidato em vários processos                      |         ✅ Feito         | Cursor      |
| F10-07 | Painel de capacidade                               |         ✅ Feito         | Cursor      |
| F10-08 | Threat model e hardening local                     |         ✅ Feito         | Cursor      |
| F10-09 | Runbooks e checklist do piloto                     |         ✅ Feito         | Cursor      |
| F10-10 | Go/no-go do piloto                                 |   ⏸️ Pendente (pulada)   | Renato      |

## Documentos de referência

- [Plano Técnico e de Produto](plano-sistema.md)
- [Plano de Implementação Orquestrado](plano-implementacao.md)
- [ADR 0001 — Contexto inicial](adr/0001-contexto-inicial.md)
- [ADR 0002 — Multi-tenant (aceito)](adr/0002-multi-tenant.md)
- [ADR 0003 — CNPJ e revisão de empresa (provisório)](adr/0003-verificacao-empresa.md)
- [ADR 0004 — LLM e regras de vaga (provisório)](adr/0004-vagas-llm.md)
- [ADR 0005 — Candidatura, match e notificações (provisório)](adr/0005-candidatura-match-notificacoes.md)
- [ADR 0006 — Entrevista WhatsApp (provisório)](adr/0006-entrevista-whatsapp.md)
- [ADR 0007 — Entrevista por voz (provisório)](adr/0007-entrevista-voz.md)
- [ADR 0008 — Ranqueamento (provisório)](adr/0008-ranqueamento.md)
- [ADR 0009 — Multiprocesso (provisório)](adr/0009-multiprocesso.md)
- [Plano restante (Fases 7–10, handoff)](plano-restante.md)
- [Guia da Fase 6](fase-6-candidatura-notificacoes.md)
- [Guia da Fase 7](fase-7-entrevista-whatsapp.md)
- [Guia da Fase 8](fase-8-entrevista-voz.md)
- [Guia da Fase 9](fase-9-ranqueamento.md)
- [Guia da Fase 10](fase-10-multiprocesso.md)
- [Autoscaling local](autoscaling-local.md)
- [Threat model](threat-model.md)
- [Checklist do piloto](piloto-checklist.md)
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
