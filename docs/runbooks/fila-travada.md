# Runbook — fila travada

1. Abra o Bull Board do worker (`/admin/queues`).
2. Confira jobs em espera, ativos e falhos das filas de triagem, vaga e currículo.
3. Um job falho por token interno inválido: confira `INTERNAL_JOB_TOKEN` igual na API e no worker. Não cole o valor em log ou issue.
4. Webhook duplicado não deve multiplicar resposta. Se a fila crescer com o mesmo `mensagemIdProvedor`, o deduplicador já devolve `duplicado`.
5. Sem Redis local, os testes usam fila em memória. Isso não reproduz fila travada de produção.
