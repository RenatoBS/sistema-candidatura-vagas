# ADR 0009 — Multiprocesso, cotas e capacidade

**Status:** Provisório (revisável pelo Renato)  
**Data:** 2026-10-07  
**Autor:** Cursor (Grok)  
**Aprovação:** pendente

## Contexto

A Fase 10 precisa isolar empresas, limitar uso por tenant e mostrar capacidade sem nuvem nem Redis obrigatório nos testes.

## Decisão provisória

- **Cota de API:** 2 000 requisições por minuto por `empresaId` nas rotas que levam esse parâmetro. Rotas `/interno/` não entram na conta. Override: `COTA_API_POR_MINUTO`.
- **Cota de IA:** 500 avaliações por hora por empresa, só quando a avaliação chama o modelo. Override: `COTA_IA_POR_HORA`.
- **Cota de voz:** 4 sessões simultâneas por empresa, além do teto global de 50 (`VOZ_MAX_SESSOES`). Override: `COTA_VOZ_POR_EMPRESA`.
- **Uma sessão de voz por candidato** em todos os processos. A segunda tentativa enquanto a primeira está ativa responde `SESSAO_VOZ_EM_ANDAMENTO`.
- **Pausa** impede aceite novo. A sessão já aberta continua. **Fechamento** encerra a sessão ativa sem deixá-la `ATIVA`.
- Contadores ficam em memória neste estágio. Não são distribuídos entre réplicas.
- Autoscaling, threat model e runbooks são documentação local. F10-10 (go/no-go) fica com o Renato.

## Consequências

- Em mais de uma réplica da API, a cota não é global. O piloto com um processo só não esbarra nisso.
- Os números não foram calibrados com tráfego real.
