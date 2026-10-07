# ADR 0005 — Candidatura, match e notificações

**Status:** Provisório (revisável pelo Renato)  
**Data:** 2026-10-06  
**Autor:** Codex  
**Aprovação:** pendente

## Contexto

A Fase 6 conecta candidatura direta e convite de match, cálculo de compatibilidade e notificações. Era necessário fixar padrões locais e idempotentes sem tornar push ou embeddings externos pré-requisitos para desenvolvimento.

## Decisão provisória

- **Q17 — visibilidade:** `visivelParaMatch` é opt-in e tem default `false` para novos cadastros. Candidatos já existentes mantêm seu valor atual; o backfill ainda depende de decisão do Renato.
- `MATCH_LIMIAR_FORTE` é configurável por ambiente e tem padrão `0.75`. O limiar pessoal de uma empresa só pode aumentá-lo.
- No `match-v1`, compatibilidade é `0,6 × cosseno + 0,4 × cobertura ponderada de habilidades`. `EmbeddingProvider` fake é o padrão; recomenda-se `EMBEDDING_PROVIDER=fake` quando `OPENAI_API_KEY` existe apenas para LLM.
- Push usa adapter Expo e mock por padrão. Expo real exige `EXPO_ACCESS_TOKEN` e `PUSH_PROVIDER=expo`; APNs/FCM não são exigidos nesta fase (F6-01 do Renato continua pendente). A central in-app é a fonte de verdade.
- `MATCH_FORTE` deduplica por vaga+candidato. `CANDIDATO_NOVO` deduplica por vaga+janela de 60 minutos; a partir de 3 eventos a apresentação vira resumo. Vagas pausadas ou fechadas não geram essas notificações.
- Pausar uma vaga leva todo estado ativo, inclusive `CONVIDADA` e `EM_REVISAO`, para `EM_ESPERA`. O controle otimista usa `atualizadoEm`; não há coluna `versao`.
- A política RLS `candidaturas_sistema` permite leituras internas quando `app.is_system` está ativo, mas o serviço continua checando o dono/contexto antes de expor dados.
- Efeitos de retry (`SUSPENDER`, `REAGENDAR`, `CANCELAR`) ficam para a Fase 7.

## Consequências

O desenvolvimento e a CI permanecem determinísticos e sem chamadas de IA ou push reais. A decisão de opt-in evita exposição involuntária; candidatos legados exigem decisão explícita de backfill. O push pode falhar ou não estar configurado sem substituir a central in-app.

## Referências

- [Plano de implementação §7.8](../plano-implementacao.md)
- [Guia da Fase 6](../fase-6-candidatura-notificacoes.md)
- [ADR 0002 — Modelo multi-tenant](0002-multi-tenant.md)
