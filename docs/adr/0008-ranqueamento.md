# ADR 0008 — Ranqueamento

**Status:** Provisório (revisável pelo Renato)  
**Data:** 2026-10-07  
**Autor:** Cursor (Grok)  
**Aprovação:** pendente

## Contexto

A Fase 9 ordena candidaturas para a empresa e o admin. O candidato continua vendo só estado e fase. Q16 (LGPD art. 20) fica com o Renato e o jurídico.

## Decisão provisória

- **Q15 — pesos:** perfil 10, habilidades 25, currículo 10, LinkedIn 2, triagem 23, voz 30. A soma é 100. O limiar de match forte permanece 0,75 (ADR 0005).
- **Fórmula:** `scoreFinal = Σ(peso_i × score_i) / Σ(peso_i dos componentes disponíveis)`, em escala 0–100. Componente ausente sai da soma. LinkedIn ausente vale 0 e continua na soma.
- **Completude:** fração dos seis componentes presentes. A explicação diz "parcial — N de 6" quando falta fase.
- **SEM_RESPOSTA:** triagem vale 0 e fica sinalizada. Abandono e expiração usam as respostas que entram na média; pergunta sem resposta vale 0 na fase.
- **Revisão humana** substitui a nota da IA e dispara recálculo.
- **Debounce:** 2 s por vaga. `versaoAlgoritmo` = 1.
- **Ranking invisível:** `vazarRanking` falha se um JSON do candidato tiver `score*`, `posicao`, `ranking`, `percentil` ou `totalCandidatos`.

## Consequências

- Os pesos não estão calibrados com dados reais.
- Q16 não tem canal de explicação ao candidato nesta entrega.
