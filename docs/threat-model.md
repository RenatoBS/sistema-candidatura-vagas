# Threat model (local)

Revisão provisória para a Fase 10. Não substitui pentest nem a decisão do Renato sobre o piloto.

| Superfície | Risco | Controle neste repositório |
| --- | --- | --- |
| Tenant | empresa A lê dados da B | contexto de tenant, RLS nas tabelas com `empresaId`, teste HTTP de acesso cruzado |
| Admin | bypass sem rastro | MFA + visão ADMIN; leitura cruzada de vaga, triagem, ranking e voz grava `BYPASS_ADMIN` |
| Webhook Uazapi | evento forjado ou repetido | segredo `x-webhook-secret`, token da instância, deduplicação por mensagem |
| Ranking | candidato vê score | teste de ranking invisível da Fase 9 |
| Segredos | token no git | gitleaks na CI; `.env` fora do repositório |
| Cota | um tenant esgota voz, IA ou API dos outros | limite por `empresaId` |
| OWASP | injeção e sessão | consultas via Prisma, JWT com segredo de ambiente, filtro de erro sem stack na resposta |

Pendências do Renato: Q16, Q18, F10-10, provedores reais (F7-01, F8-15).
