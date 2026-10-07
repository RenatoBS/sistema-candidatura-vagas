# ADR 0010 — Segredo do webhook da Uazapi

**Status:** Provisório (revisável pelo Renato)
**Data:** 2026-10-07
**Autor:** Claude Code (Sonnet 5.5)
**Aprovação:** pendente

## Contexto

O teste local de 2026-10-07 (F3) mostrou que o webhook da Uazapi respondia sempre 401: a API exige o segredo em `x-webhook-secret`, mas o registro do webhook (`POST /webhook` da instância) só enviava `url`, `events` e `excludeMessages`. Além disso, a URL usava `localhost`, inalcançável pela Uazapi.

Não há documentação pública que garanta suporte a headers customizados no registro do webhook.

## Decisão

- O segredo `UAZAPI_WEBHOOK_SECRET` vai na **query** da URL registrada (`?segredo=...`). A rota aceita o segredo na query **ou** no header `x-webhook-secret` (caso a Uazapi passe a suportá-lo); a comparação é em tempo constante (`timingSafeEqual`).
- Defesa adicional já existente: se o payload traz o `token` da instância, ele é comparado ao token cifrado da instância.
- O log mascara o parâmetro (`redigirUrl` em `apps/api/src/logger.ts`) e os headers sensíveis (`redact` do pino).
- `UAZAPI_WEBHOOK_SECRET` é obrigatório quando `UAZAPI_BASE_URL` ou `UAZAPI_ADMIN_TOKEN` estão definidos (falha no boot).
- `API_PUBLIC_URL` precisa ser uma URL válida e, fora de `development`/`test`, não pode apontar para `localhost`/`127.0.0.1`/`0.0.0.0`/`::1`.

## Consequências

- O segredo aparece na URL guardada pela Uazapi e em logs de proxies/CDN à frente da API; **rotacionar o segredo** (e re-registrar os webhooks: basta o monitor reconectar a instância) se houver suspeita de vazamento. Proxies reversos devem mascarar a query dessa rota.
- Se a Uazapi suportar header customizado, migrar para o header e remover a query, sem alterar o servidor (já aceita ambos).
- Em desenvolvimento a Uazapi não alcança `localhost`: use um túnel (ver [runbook](../runbooks/webhook-uazapi-dev.md)).
