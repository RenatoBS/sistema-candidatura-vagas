# ADR 0006 — Entrevista WhatsApp via Uazapi

**Status:** Provisório (revisável pelo Renato)  
**Data:** 2026-10-06  
**Autor:** Codex  
**Aprovação:** pendente

## Contexto

A Fase 7 precisa receber mensagens da instância WhatsApp de cada empresa, tratar áudio sem depender de serviços reais nos testes e manter a entrevista auditável, idempotente e compatível com as regras de consentimento.

## Decisão provisória

- **Q2 — STT:** Whisper (`whisper-1`) atrás de `SttProvider`. Fake é o padrão em desenvolvimento e testes; OpenAI só é usado quando `STT_PROVIDER=openai` e `OPENAI_API_KEY` está definido.
- **Q7 — retry e cadência:** após o convite haverá até 3 retries (4 envios no total), intervalo de 24 h e prazo total de 96 h antes de `SEM_RESPOSTA`, congelado durante pausas. Após o início, 24 h de inatividade leva a `ABANDONADA`, com um lembrete na metade (12 h). O horário comercial é segunda a sexta, 9h–18h, em `America/Sao_Paulo`. Os valores iniciais por instância são no máximo 20 mensagens/minuto e 200 mensagens/hora, com atraso humano aleatório de 3–8 s; esses parâmetros ainda podem ser calibrados.
- **Q8 — texto e áudio:** texto é aceito, mas o candidato recebe uma solicitação de áudio uma vez. Texto repetido para a mesma pergunta é aceito como `TEXTO_WHATSAPP` e sinalizado para revisão. “ok”, “oi” e dúvidas não contam como resposta.
- **Q19 — avanço de fase:** a passagem da primeira para a segunda fase é manual; o sistema apenas recomenda.
- **Q21 — verificação e opt-in:** o número é confirmado no primeiro contato pela instância da empresa, além de opt-in no app. Nenhum envio ocorre sem opt-in registrado de `WHATSAPP` e `AUDIO_WHATSAPP`. A confirmação de opt-out (`PARAR`) é a única exceção (`excecaoOptOut`). “Não” na confirmação do número não apaga a entrevista; um “Sim” posterior pode seguir.
- **Política efetiva:** `politicaTriagemEfetiva` usa tentativas, horário comercial e prazo de inatividade da vaga. Se o intervalo ainda é o padrão da Fase 4 (240 min) e o prazo total ainda é 72 h, o motor operacional usa 24 h e 96 h deste ADR. Valores explícitos da vaga vencem. O lembrete de inatividade sai na metade do prazo.
- **Começar não consome a tentativa.** A marca de início é o primeiro áudio ou texto aceito. Uma conversa ativa por candidato e empresa; as demais ficam `AGENDADA`.
- **Trava e limite de envio** nos testes são em memória. Em mais de um processo da API, a trava não é distribuída. O limite de 20/min e 200/h também é por processo enquanto não houver Redis no limitador.
- O webhook usa `UAZAPI_WEBHOOK_SECRET`. Eventos são deduplicados por Redis e por índice único no banco. O limiar inicial de confiança do STT é `STT_LIMIAR_CONFIANCA=0.6`; abaixo dele há revisão humana sem penalidade. Áudios com menos de 2 s não são respostas válidas. Áudios recebidos em uma janela de agregação de 60 s podem ser agrupados.

## Consequências

As interfaces permitem testes determinísticos e substituição futura do provedor. Redis e o índice único protegem contra reentrega do webhook; a persistência mantém auditoria por tenant. Os limites de cadência, duração e confiança são deliberadamente configuráveis e devem ser revisados com dados reais antes de produção.

## Referências

- [Plano de implementação §7.9](../plano-implementacao.md)
- [Plano do sistema §§4.6, 6.1 e 8.5](../plano-sistema.md)
- [ADR 0002 — Modelo multi-tenant](0002-multi-tenant.md)
- [ADR 0005 — Candidatura, match e notificações](0005-candidatura-match-notificacoes.md)
