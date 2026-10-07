# Runbook — latência de voz

1. A meta local é p50 abaixo de cerca de 1 s por etapa do pipeline falso (STT, LLM, TTS).
2. `pnpm --filter @scv/voice-agent poc:mock` mede o pipeline sem rede.
3. `GET /interno/capacidade` alerta `voz_perto_do_limite` a partir de 80% do teto global.
4. Cota por empresa (`COTA_VOZ_POR_EMPRESA`, padrão 4) recusa com `COTA_VOZ` antes de afetar as outras.
5. Queda curta reconecta na mesma sessão (ADR 0007). Não há LiveKit real neste ambiente.
