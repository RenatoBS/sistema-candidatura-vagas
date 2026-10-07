# Fase 8 — Entrevista por voz

Guia da entrega local. Decisões provisórias: [ADR 0007](adr/0007-entrevista-voz.md). O POC de latência continua em [docs/pocs/voz-latencia.md](pocs/voz-latencia.md).

## O que a fase faz

- Prepara a entrevista só com consentimento `GRAVACAO_VOZ` e vaga que não está pausada nem fechada.
- Aceite cria uma sessão com token falso de LiveKit e faz a primeira pergunta do roteiro.
- Turnos seguem a ordem das perguntas. Follow-up só cabe no tempo restante.
- Estouro grava `expirou` e avança, sem reprovar.
- Fechar a sessão marca `ABANDONADA` e consome a tentativa.
- Queda de até 60 s volta à mesma sessão, com o cronômetro pausado. Depois disso, abandona.
- Uma exceção manual, auditada, devolve a entrevista a `DISPONIVEL`.
- Empresa e admin acessam transcrição e gravação com motivo.

## Como testar

```bash
pnpm --filter @scv/domain test
pnpm --filter @scv/api test -- test/fase8.voz.test.ts
pnpm --filter @scv/voice-agent test
```

O app do candidato abre `candidato/voz/:candidaturaId` (pré-checagem, tempo, aviso, reconexão e confirmação de encerramento). A empresa lista em `empresa/vagas/:id/voz` e ouve em `empresa/voz/:entrevistaId`. O player usa `Linking.openURL`; não foi exercitado em simulador.

## Runbook local

1. Subir Postgres se for usar `AUTH_STORE=prisma`. Os testes da fase usam repositório em memória.
2. `pnpm --filter @scv/voice-agent poc:mock` mede o pipeline sem APIs.
3. Uma sessão cai: o candidato reconecta em até 60 s. O tempo da pergunta não corre durante a queda.
4. Se a fila responder `FILA_ADMISSAO`, há 50 sessões ativas neste processo. Encerrar uma libera a vaga.
5. Exceção: um membro com `revisao_humana` envia o motivo em `POST /empresas/:id/voz/:entrevistaId/excecao`. Só vale uma vez.
6. Gravação: `GET .../gravacao?motivo=` registra `LER_AUDIO`. Sem motivo, a API recusa.

F8-15 (chaves e provedores de staging) permanece com o Renato.
