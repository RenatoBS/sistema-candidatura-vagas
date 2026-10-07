# Fase 9 — Ranqueamento

Decisões provisórias: [ADR 0008](adr/0008-ranqueamento.md).

O score usa seis componentes. Fase que não ocorreu sai da média e a completude cai. LinkedIn vazio vale 0. Mudar pesos ou registrar revisão humana recalcula. O candidato não recebe score, posição, percentil nem total de candidatos.

```bash
pnpm --filter @scv/domain test
pnpm --filter @scv/api exec node --import tsx --test test/fase9.ranking.test.ts
```

A empresa abre `empresa/vagas/:id/ranking`. A tela não foi exercitada em simulador.
