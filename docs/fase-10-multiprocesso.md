# Fase 10 — Multiprocesso

Decisões provisórias: [ADR 0009](adr/0009-multiprocesso.md).

## O que a suíte cobre

- Acesso cruzado em vaga, triagem, ranking e voz responde 403 ou 404. O admin com MFA lê a vaga e gera auditoria `BYPASS_ADMIN`.
- Cota de voz, de API e de IA de uma empresa não bloqueia a outra.
- Webhook duplicado em paralelo gera um evento só.
- Pausa bloqueia aceite novo e mantém a sessão em curso. Fechar a vaga finaliza a sessão.
- Candidato em três empresas recebe convite com o título da vaga. Na mesma empresa, o segundo processo fica `AGENDADA`.
- Uma sessão de voz por candidato.
- Oito recálculos paralelos preservam oito scores. O p50 do pipeline falso fica abaixo de 1 s.
- `GET /interno/capacidade` devolve sessões, cotas, instâncias e alertas.

## Carga k6

```bash
k6 run infra/k6/multiprocesso.js
```

A CI não depende do k6. O teste Node acima é a prova que roda em todo push.

## Fora deste entregável

F10-10 (go/no-go do piloto) continua com o Renato.
