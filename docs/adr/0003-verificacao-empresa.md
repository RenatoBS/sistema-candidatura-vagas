# ADR 0003 — Fonte de CNPJ e revisão manual de empresas

**Status:** Provisório (revisável pelo Renato)  
**Data:** 2026-10-06  
**Autor:** Cursor (Grok 4.7), a partir das decisões do orquestrador (F3-01 / Q5 / Q6)  
**Aprovação:** pendente — Renato pode substituir a fonte ou a política sem mudar o domínio

## Contexto

A Fase 3 precisa validar o CNPJ da empresa (dígitos, situação cadastral e razão social) e decidir quando a verificação fica na fila manual do admin. As perguntas Q5 e Q6 do plano de implementação ainda não tinham decisão fechada do Renato. O orquestrador fixou padrões provisórios para destravar F3-06 e F3-07.

## Decisão provisória

### Q5 — Fonte cadastral de CNPJ

- A fonte padrão é a **BrasilAPI**, gratuita: `GET https://brasilapi.com.br/api/cnpj/v1/{cnpj}`.
- O acesso fica atrás da interface `FonteCnpjProvider` (`consultar`), para trocar por ReceitaWS ou outra fonte paga sem alterar a regra de negócio.
- Os **dígitos verificadores são sempre validados localmente** antes de qualquer chamada externa.
- A consulta cadastral roda em **job assíncrono BullMQ** (`verificar-cnpj`). A API só enfileira.
- Testes usam mock do provider e **não** chamam a BrasilAPI.

Situação ativa e razão social compatível (comparação normalizada, sem acento e sem diferença de caixa) contam como checagem `CNPJ` ok. CNPJ inativo, razão divergente ou fonte indisponível contam como falha.

### Q6 — Revisão manual

A revisão manual ocorre **somente em falha**, salvo configuração explícita.

Variável `REVISAO_MANUAL_EMPRESA`:

| Valor | Comportamento |
|-------|----------------|
| `falha` (padrão) | Vai para a fila do admin se o CNPJ estiver inativo ou divergente, se a fonte estiver indisponível ou se o domínio não for confirmado. Se e-mail, domínio e CNPJ passarem, a empresa fica `VERIFICADA` sem fila. |
| `sempre` | Mesmo com todas as checagens ok, permanece `PENDENTE` até o admin aprovar. |
| `nunca` | Não entra na fila. Só fica `VERIFICADA` quando as checagens automáticas passam; falha permanece `PENDENTE` para nova tentativa do responsável. |

Confirmação de domínio: e-mail do responsável no domínio declarado (e que não seja provedor genérico) **ou** registro DNS TXT `scv-verificacao=<token>`.

## Alternativas

| Alternativa | Por que não agora |
|-------------|-------------------|
| ReceitaWS / Serpro pagos | Custo e credencial; o adapter permite trocar depois |
| Consulta síncrona na requisição de cadastro | Acopla o cadastro à disponibilidade da fonte |
| Revisão manual sempre ligada | Atrasa empresas que já passaram nas checagens |

## Consequências

- Sem chave de API para CNPJ em desenvolvimento.
- Se a BrasilAPI mudar o contrato ou limitar taxa, a mitigação é outro `FonteCnpjProvider` ou a fila manual (`falha`).
- Esta decisão **não** está aceita como definitiva até o Renato revisar.

## Referências

- [Plano de implementação §7.5 e Q5/Q6](../plano-implementacao.md)
- [Plano do sistema §3.1 e §6](../plano-sistema.md)
