# CLAUDE.md

Este arquivo orienta o **Claude Code** neste repositório.

## Contexto

Leia e siga [`AGENTS.md`](AGENTS.md) como fonte única de convenções, stack, comandos e proibições.

## Fluxo esperado

1. **Brief** — leia o brief da tarefa em `docs/briefs/` (ou a seção correspondente em `docs/plano-implementacao.md`).
2. **Plano** — descreva o que vai fazer antes de codificar (arquivos, dependências, riscos).
3. **Código** — implemente com escopo mínimo; siga as convenções do repositório.
4. **Testes** — adicione testes para comportamento novo; rode `pnpm lint && pnpm typecheck && pnpm test`.
5. **PR** — resumo do que mudou, como testar, critérios de aceite, riscos, agente autor e modelo.

## Papel do Claude Code neste projeto

- Módulos de domínio complexos, arquitetura, refatorações amplas.
- ADRs, briefs, revisão com foco em arquitetura.
- Tenancy/RLS, máquinas de estado, orquestração de triagem, agente de voz, score.

## Ao bater limite de uso

Registre no PR: feito / falta / próximos passos. Outro agente continua na mesma branch.

## Links

- [AGENTS.md](AGENTS.md)
- [Status](docs/STATUS.md)
- [Plano de implementação](docs/plano-implementacao.md)
