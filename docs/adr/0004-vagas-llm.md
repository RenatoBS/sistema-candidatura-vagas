# ADR 0004 — LLM e regras provisórias de vaga (Q4, Q11–Q14)

**Status:** Provisório (revisável pelo Renato)  
**Data:** 2026-10-06  
**Autor:** Cursor (Grok 4.7), a partir das decisões do orquestrador (F4-02 / Q4, Q11–Q14)  
**Aprovação:** pendente — Renato pode trocar o provedor, os prazos de pausa ou as regras de reabertura sem reescrever o domínio

## Contexto

A Fase 4 precisa sugerir perguntas com IA e fechar o ciclo de vida da vaga (publicar, prorrogar, pausar, retomar, fechar, encerrar inscrições). Q4 e Q11–Q14 do plano de implementação ainda não tinham decisão fechada do Renato. O orquestrador fixou padrões provisórios para destravar F4-06 e F4-07. A Fase 5 reutiliza o mesmo `LlmProvider`.

## Decisão provisória

### Q4 — Provedor de LLM

- A interface `LlmProvider` fica no pacote compartilhado `@scv/llm` (`packages/llm`), não nas regras de vaga.
- Implementações: `mock` (padrão em dev e teste, determinística, sem rede), `openai` (env `OPENAI_API_KEY` e `LLM_MODELO`) e `ollama` local (`OLLAMA_BASE_URL`, padrão `http://localhost:11434`).
- A seleção é a env `LLM_PROVIDER` (`mock` | `openai` | `ollama`). Sem valor, usa `mock`.
- Prompts versionados em arquivos (`packages/llm/prompts/`). A sugestão de perguntas usa `sugerir-perguntas/v1`.
- Nenhum teste chama API real. OpenAI e Ollama só são exercitados com `fetch` injetado.
- `packages/providers` reexporta o tipo para não haver duas interfaces.

### Q11 — Reabrir inscrições após o prazo

Permitido **somente** por **prorrogar** com prazo futuro, a partir de `INSCRICOES_ENCERRADAS`. A transição volta a `PUBLICADA`, limpa `inscricoesEncerradasEm` e gera auditoria. Não existe endpoint de “reabrir”.

### Q12 — Congelar o prazo na pausa

**Não congela** (padrão do plano). `prazoInscricoes` segue correndo em UTC. Na retomada, se o prazo já passou, a vaga vai para `INSCRICOES_ENCERRADAS`.

### Q13 — Duração máxima da pausa

30 dias, configurável por `PAUSA_MAX_DIAS`. Ao estourar, a varredura emite o evento `AlertaPausaLonga` para a empresa. A vaga **não** fecha sozinha.

### Q14 — Reabrir vaga fechada

**Não.** `FECHADA` é terminal. A alternativa é `POST /vagas/{id}/duplicar`, que cria um rascunho novo (habilidades, processo e perguntas já aprovadas) sem candidaturas.

## Consequências

- A máquina de estados da vaga ganha a transição `INSCRICOES_ENCERRADAS → PUBLICADA` exclusiva da prorrogação.
- Jobs internos de prazo usam `app.is_system` no banco (não é bypass de admin). O admin continua exigindo MFA.
- A Fase 5 deve importar `@scv/llm` para extração de currículo, em vez de criar outro cliente de modelo.

## Referências

- [Plano do sistema §7](../plano-sistema.md)
- [Plano de implementação §7.6 e §9](../plano-implementacao.md)
