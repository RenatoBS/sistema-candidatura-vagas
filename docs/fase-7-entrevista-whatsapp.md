# Fase 7 — entrevista por WhatsApp

## Entregas

- F7-05: monitoramento da instância, alerta para empresa e admin, suspensão e retomada sem consumir tentativa.
- F7-06: orquestrador da triagem, convite com aviso de tentativa única, cinco perguntas e conclusão.
- F7-07: retries em horário comercial, pausa, fechamento e limite por instância.
- F7-08: inatividade com lembrete na metade do prazo e abandono com avaliação parcial.
- F7-10: avaliação por IA com schema, prompt versionado e conteúdo do candidato delimitado.
- F7-11: borda de áudio, texto, mídia inválida, agregação e opt-out.
- F7-12: confirmação do número e guarda de envio sem opt-in.
- F7-13: telas da empresa para estado, áudio auditado, transcrição, nota e revisão.
- F7-14: relógio injetado nos cenários de retry, pausa, corrida e instância.
- F7-16: roteamento pela instância da empresa dona da vaga.

Ficam com o Renato: F7-01 (instância real), F7-02 (decisão final das perguntas) e F7-15 (teste com número real).

## Execução local

```bash
pnpm --filter @scv/domain test
pnpm --filter @scv/api test
pnpm --filter @scv/workers test
```

Os testes usam `AUTH_STORE=memory`, `FakeWhatsappProvider`, `FakeSttProvider` e `LlmMock`. Não chamam Uazapi nem OpenAI.

## Validação

A suíte `apps/api/test/fase7.triagem.test.ts` cobre convite, cinco áudios, nota, webhook duplicado, opt-in, instância desconectada, isolamento entre empresas, limite de envio, horário comercial, pausa, fechamento, lembrete, abandono e a tela da empresa.

## Limitações

A trava da entrevista e o limitador de envio são em memória no processo da API. O app móvel abre o áudio por URL assinada; o player nativo não foi exercitado em simulador nesta entrega. Produção continua sem deploy e sem Sentry.
