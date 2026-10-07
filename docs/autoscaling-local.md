# Autoscaling local

Não há autoscaling em nuvem nesta etapa. O desenho abaixo serve para o piloto na máquina local.

| Peça | Sinal | Ação local |
| --- | --- | --- |
| Worker BullMQ | fila crescendo no Bull Board (`/admin/queues`) | subir outro `pnpm --filter @scv/workers dev` apontando para o mesmo Redis |
| API | `GET /interno/capacidade` com `voz_perto_do_limite` | manter um processo; a cota por empresa segura o pico antes do teto global de 50 |
| Agente de voz | p50 do pipeline acima de 1 s | o pipeline atual é falso e local; LiveKit real fica para o Renato |

Os contadores de cota são em memória. Mais de uma réplica da API não soma a mesma cota.
