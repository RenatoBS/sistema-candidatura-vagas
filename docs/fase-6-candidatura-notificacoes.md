# Fase 6 — candidatura, match e notificações

## Entregas

- F6-02: máquina de estados de candidatura, pausa/retomada/fechamento e controle otimista.
- F6-03: candidatura direta, consentimento obrigatório, unicidade e DTO sem ranking.
- F6-04: embeddings e `match-v1`, com opt-in de visibilidade e limiar forte configurável.
- F6-05: convites de match, aceitação, recusa e expiração de convites pendentes.
- F6-06: `CANDIDATO_NOVO` e `MATCH_FORTE`, deduplicação, agrupamento e preferências.
- F6-07/F6-08: adapters de push e e-mail, mockados em testes.
- F6-09: central in-app e preferências.
- F6-10/F6-11: fluxos de candidato e empresa no app/API.
- F6-12: suíte de aceite e correção da expiração de convite sem sugestão associada.

## Execução local

```bash
docker compose -f infra/docker-compose.yml up -d postgres redis
pnpm --filter @scv/api test
```

Para e-mail, use Mailpit em `localhost:1025` (`SMTP_HOST`/`SMTP_PORT`). Push usa mock por padrão e pode ser inspecionado nos testes; Expo real requer `PUSH_PROVIDER=expo` e `EXPO_ACCESS_TOKEN`. Embeddings usam `EMBEDDING_PROVIDER=fake` para execução determinística sem rede.

Variáveis principais: `MATCH_LIMIAR_FORTE`, `EMBEDDING_PROVIDER`, `EMBEDDING_BASE_URL`, `EMBEDDING_API_KEY`, `PUSH_PROVIDER` e `EXPO_ACCESS_TOKEN`.

## Validação

Validação executada em 2026-10-06 no Postgres local `localhost:5433`:

- `pnpm --filter @scv/api test`: 33 testes aprovados.
- `pnpm --filter @scv/prisma db:migrate:deploy`: 7 migrações aplicadas com sucesso.
- `pnpm --filter @scv/prisma test`: 11 testes aprovados.
- Foi criada a extensão `vector`; para os testes RLS foi usado o banco descartável `scv_test` na mesma porta.

## Limitações

Push em dispositivo real não foi validado e depende da F6-01 (APNs/FCM, sob responsabilidade do Renato). A validação Prisma foi feita no Postgres descartável local; ambientes de produção ainda exigem execução da CI com credenciais próprias. A central in-app continua sendo a fonte de verdade mesmo quando push ou e-mail não estão configurados.
