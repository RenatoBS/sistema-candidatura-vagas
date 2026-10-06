# ADR 0001 — Contexto inicial do projeto

**Status:** Aceito  
**Data:** 2026-10-06  
**Autor:** Renato Souza

## Contexto

O sistema de candidatura a vagas com IA será desenvolvido por três agentes de IA (Claude Code, Codex, Cursor) sob orquestração humana (Renato). É necessário estabelecer as decisões fundamentais antes da implementação.

## Decisões

### 1. Monorepo com pnpm + Turborepo

- **pnpm workspaces** para gerenciamento de dependências com links simbólicos eficientes.
- **Turborepo** para cache e execução paralela de tarefas (lint, build, test).
- Alternativa considerada: Nx. Descartada por simplicidade e alinhamento com a stack Node.js.

### 2. App único React Native (Expo Router)

- Um único app com grupos de rota por papel: `(candidato)`, `(empresa)`, `(admin)`.
- Sem builds separados por perfil.
- Expo Router para navegação baseada em arquivos.

### 3. Backend NestJS + Prisma + BullMQ

- API REST em NestJS com TypeScript.
- Prisma ORM com PostgreSQL + pgvector.
- Processamento assíncrono via Redis + BullMQ (workers separados da API).

### 4. Provedores atrás de interfaces

- `WhatsappProvider` (Uazapi), `SttProvider`, `LlmProvider`, `OcrProvider` em `packages/providers`.
- Implementações fake para testes.
- Uma instância Uazapi (número) por empresa.

### 5. Voz em tempo real via LiveKit

- WebRTC com servidor de mídia LiveKit.
- Agente de voz como participante da sala (`apps/voice-agent`).
- Arquitetura detalhada será decidida na POC (Fase 8.1).

### 6. Orquestração por agentes com revisão humana

- Nenhum agente faz merge em `main`.
- Uma tarefa = um brief = uma branch = um PR.
- Revisão cruzada entre agentes + aprovação do Renato.

### 7. Multi-tenant com RLS

- Isolamento por `empresaId` no banco (Row-Level Security).
- Bypass auditado somente para admin com MFA.
- Detalhes na Fase 2 (ADR específico).

## Consequências

- Estrutura de pastas definida na §4.1 do plano de implementação.
- CI como juiz de qualidade desde a Fase 1.
- Decisões em aberto (Q2–Q21) documentadas no plano de implementação §9.

## Referências

- [Plano do sistema](../plano-sistema.md)
- [Plano de implementação](../plano-implementacao.md)
