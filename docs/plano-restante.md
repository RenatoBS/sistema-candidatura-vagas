# Plano restante — handoff para agente Cursor (Fases 7 a 10)

**Data:** 2026-10-06 (BRT)  
**Público:** agente Cursor trabalhando sozinho, sem supervisão, por ~19 h.  
**Autor:** executor (Grok Bot), a partir de `docs/plano-implementacao.md` §7.9–§7.12 e `docs/plano-sistema.md`.

Este documento é autossuficiente: leia-o inteiro antes de começar. Em caso de conflito, `AGENTS.md` (proibições) prevalece; depois este plano; depois os planos de referência.

---

## 1. Estado atual

| Item                      | Estado                                                                                 |
| ------------------------- | -------------------------------------------------------------------------------------- |
| Fases 1–6                 | ✅ mergeadas na `main` (último merge: `0c8aa08`, PR #11)                               |
| Fase 7                    | 🟡 em andamento na branch `feat/f7-entrevista-whatsapp` (PR draft para `main`)         |
| POC 8.1 (latência de voz) | ✅ na `main` — `docs/pocs/voz-latencia.md`, pipeline modular STT → LLM → TTS escolhido |

### Fase 7 — o que já está feito nesta branch

| ID       | Entrega                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Onde                                                                                                                                                                                                                |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ADR 0006 | Decisões provisórias Q2, Q7, Q8, Q19, Q21 (provisório, aguardando Renato)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | `docs/adr/0006-entrevista-whatsapp.md`                                                                                                                                                                              |
| F7-03    | `WhatsappProvider` + `UazapiProvider` (`/send/text`, `/send/menu`, `/send/media`, `/message/download`, header `token` da instância) + `FakeWhatsappProvider` + `baixarConteudoMidia`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `packages/providers/src/whatsapp.ts`                                                                                                                                                                                |
| F7-04    | Webhook `POST /api/v1/webhooks/whatsapp/uazapi/:instanciaId`: `x-webhook-secret` (tempo constante, `UAZAPI_WEBHOOK_SECRET`), token da instância no payload, normalização (`normalizarWebhookUazapi`), ignora fromMe/API/grupo, dedup Redis (`DeduplicadorWebhook`) + índice único em `eventos_whatsapp_entrada` (RLS), fila `whatsapp-entrada` com `jobId = <instanciaId>:<mensagemIdProvedor>`                                                                                                                                                                                                                                                                                                                                                                                      | `apps/api/src/whatsapp/webhook-uazapi.service.ts`, `apps/api/src/fila/fila-whatsapp-entrada.ts`, migração `20261008010000_whatsapp_fase7`, `apps/api/test/fase7.webhook.test.ts`                                    |
| F7-09    | `SttProvider` (`OpenAiWhisperStt` + `FakeSttProvider`, `criarSttProvider`), `FfmpegConversor` (OGG/Opus → WAV 16 kHz, duração pelo header WAV) + fake, `Armazenamento.salvar`, `TranscricaoService` em `POST /api/v1/interno/triagem/respostas/:id/transcrever` e `.../falha`, worker `stt-transcricao` (attempts 3, backoff) chamando a rota interna; `Resposta.revisaoHumanaNecessaria` e `Resposta.mensagemIdProvedor`                                                                                                                                                                                                                                                                                                                                                            | `packages/providers/src/stt.ts`, `conversor-audio.ts`, `apps/api/src/triagem/transcricao.service.ts`, `apps/workers/src/triagem-jobs.ts`, `apps/api/test/fase7.transcricao.test.ts`                                 |
| F7-08    | **Núcleo feito** (commits `b003ad1`, `74d1283`): domínio `triagem-inatividade.ts` (marco de início, `podeReiniciar`, prazo 24 h, lembrete 12 h, `avaliarInatividade`), templates `mensagens-triagem.ts` (convite com aviso de tentativa única, lembretes), `EntrevistasRepositorio` memória/Prisma com 409 `ENTREVISTA_JA_EXISTE`, `TriagemInatividadeService` (abandono idempotente com controle otimista → `ABANDONADA`, respostas `parcial`, candidatura `abandonarTriagem`, avaliação parcial via `AvaliadorTriagemNoop`; aceite "Começar" sem iniciar, 409 `TENTATIVA_CONSUMIDA`), rotas `interno/triagem/entrevistas/:id/abandonar-inatividade` e `.../aceitar`, worker `triagem-inatividade` (`agendarInatividade`), `apps/api/test/fase7.inatividade.test.ts`. Resto em §3.1 | `packages/domain/src/triagem-inatividade.ts`, `mensagens-triagem.ts`, `apps/api/src/repositorio/entrevistas-*.ts`, `apps/api/src/triagem/triagem-inatividade.service.ts`, `apps/workers/src/triagem-inatividade.ts` |

Costuras já existentes (no-op) a serem preenchidas: avaliação IA após transcrição (fila `ia-avaliacao`, F7-10); consumidor da fila `whatsapp-entrada` (F7-16/F7-06).

---

## 2. Regras de execução (obrigatórias)

1. **Tudo local.** Sem deploy, sem nuvem, sem Sentry. Infra local: Postgres+pgvector (há um Postgres 17 descartável na porta **5433** — use só por variável de ambiente, **nunca** como default em código/teste commitado), sem Redis local (testes não podem depender de Redis: interfaces com implementação em memória).
2. **Testes nunca chamam a Uazapi real nem a OpenAI real** (nem LiveKit real). Sempre `fetch` injetado/fakes. ffmpeg real só em teste pulado automaticamente quando não houver `ffmpeg` no PATH.
3. **Nunca commitar segredos** (`.env`, tokens, chaves; `.secrets/` é gitignored e não deve ser lido nem copiado). Sem PII real em fixtures/logs (números fictícios tipo `5511900000001`). Não logar tokens, segredos nem número completo.
4. **Um PR por fase.** A Fase 7 continua no PR desta branch (`feat/f7-entrevista-whatsapp`). Fases seguintes: `feat/f8-...`, `feat/f9-...`, `feat/f10-...`, cada uma criada a partir da `main` atualizada.
5. **Ordem das fases: 7 → 8 → 9 → 10.** A Fase 8 só começa depois que o PR da Fase 7 for mergeado. Idem 9 após 8 e 10 após 9.
6. **Merge somente com squash e somente com a CI verde** (todos os jobs: lint/typecheck/testes, migrações, RLS, build, gitleaks). Jobs flaky: rerun. Nunca force-push na `main`. (Observação: `AGENTS.md` diz que o merge é do Renato; esta delegação foi autorizada por ele para este handoff — registre no PR "merge feito pelo agente com autorização do Renato".)
7. **Conventional Commits em pt-BR**, com o ID da tarefa no título (ex.: `feat(api): roteamento por empresa (F7-16)`). Commits pequenos; **push frequente** (após cada tarefa concluída).
8. **Manter `docs/STATUS.md` e os ADRs atualizados** a cada tarefa/fase (checklist com status e responsável "Cursor"). Toda decisão provisória vira/atualiza um ADR marcado **Provisório (revisável pelo Renato)**.
9. Não alterar migrações já mergeadas na `main`. Migração nova por mudança de schema, timestamp crescente (a última desta branch é `20261008010000_whatsapp_fase7`). Tabelas com `empresaId`: `ENABLE` + `FORCE ROW LEVEL SECURITY`, política tenant `FOR ALL USING (app_is_admin() OR "empresaId" = app_current_empresa_id()) WITH CHECK (...)` + política `_sistema` (`app.is_system`), e teste em `prisma/test/isolation.test.ts`. Verificar drift com `prisma migrate diff --from-migrations ... --to-schema-datamodel ...` (só os índices de `embedding` são diferença pré-existente). Não rodar `prisma format` em arquivos inteiros. `prisma migrate reset` é bloqueado — para banco limpo, crie um database novo descartável.
10. Não alterar `.github/workflows` sem necessidade (o token `gh` local não tem escopo `workflow`; se for indispensável, registre no PR para o Renato).
11. Padrões do repo: API NestJS com repositório em memória **e** Prisma (`*-memoria.ts`/`*-prisma.ts`); testes HTTP em `apps/api/test/faseN.*.test.ts` (um app por arquivo, `limparAmbienteTeste` no `beforeEach`, fakes em `ambiente-teste.ts`); workers chamam a API interna por `postInterno` (`x-internal-token`); OpenAPI/contratos atualizados quando a API muda; telas Expo Router sem apagar telas existentes e com rotas válidas.
12. **DTO do candidato nunca expõe score**, posição, percentil ou total de candidatos.
13. Validação antes de cada push: `pnpm lint && pnpm typecheck && pnpm test && pnpm build` (Prisma/RLS: `DATABASE_URL`/`MIGRATION_DATABASE_URL`/`RLS_DATABASE_URL` apontando para um banco local descartável).
14. Tarefas do Renato **não** são executadas: ficam marcadas como pendentes/puladas (ver §6).

---

## 3. Fase 7 — o que falta (§7.9)

Ordem sugerida (respeita dependências): F7-08 (resto) → F7-12 → F7-16 → F7-06 → F7-05 → F7-07 → F7-11 → F7-10 → F7-13 → F7-14.

### 3.1 F7-08 — Tentativa consumida/abandono (resto)

O núcleo está feito (ver §1). Falta, e depende de F7-06/F7-07/F7-10:

- Chamar `registrarPrimeiraResposta` e `agendarInatividade(entrevistaId, ultimaInteracaoEm)` a cada resposta, a partir do orquestrador (F7-06); cancelar o job anterior.
- Enviar o **lembrete de inatividade** (1 vez, na metade do prazo — resultado `LEMBRETE` de `avaliarInatividade`) pelo guarda de envio (F7-12), sem reiniciar a tentativa.
- Registrar as **perguntas não respondidas como sinalizadas** (sem nota) no abandono e trocar `AvaliadorTriagemNoop` pela avaliação parcial real (F7-10).
- Ler a política de inatividade da política de retry da vaga/processo (F4-04) em vez de só `POLITICA_INATIVIDADE_PADRAO`.
- Teste com relógio simulado de corrida timeout × resposta simultânea (F7-14).
  **Aceite:** após a primeira resposta nenhuma nova tentativa é possível; inatividade além do prazo → `ABANDONADA` com avaliação parcial; segunda entrevista para a mesma candidatura+fase é rejeitada; o convite avisa sobre a tentativa única.

### 3.2 F7-12 — Verificação do número do candidato + opt-in (Q21)

Confirmação no primeiro contato pela instância da empresa ("Este número pertence a <nome>? 1 Sim / 2 Não"), sem SMS; opt-in (consentimento WhatsApp/áudio da F5-06) registrado no app; trocar o número zera `whatsappVerificado` (+ `whatsappVerificadoEm`). **Guarda central de envio** (`EnviadorWhatsapp`) por onde passa todo envio: recusa sem chamar o provider se não houver opt-in (`SEM_OPT_IN`), instância não `CONECTADA` (`INSTANCIA_INDISPONIVEL`, sem consumir tentativa) ou número ausente; gancho `LimitadorEnvio` para F7-07.  
**Aceite:** nenhum envio sem opt-in registrado (teste verifica que o fake não recebeu nada).

### 3.3 F7-16 — Roteamento por empresa

Consumidor da fila `whatsapp-entrada`: webhook → instância → empresa → entrevista ativa do candidato **naquela empresa** (pelo número normalizado); envio da 1ª fase sempre pela instância da empresa dona da vaga; **bloqueio de iniciar a 1ª fase sem instância conectada** (candidatura aguarda em `INSCRITA` com alerta à empresa, sem consumir tentativa); marcar `eventos_whatsapp_entrada.status` PROCESSADO/IGNORADO.  
**Aceite:** sem instância conectada a empresa não consegue iniciar a 1ª fase (teste); mensagem recebida na instância da empresa A nunca é roteada para entrevista da empresa B (teste de isolamento).

### 3.4 F7-06 — Orquestrador da triagem

Estados §8.5.4 (AGENDADA, AGUARDANDO_INICIO, RETRY_1..3, EM_ANDAMENTO, AGUARDANDO_RESPOSTA, PROCESSANDO, CONCLUIDA, ABANDONADA, SEM_RESPOSTA, RECUSADA, CANCELADA, SUSPENSA_PAUSA, SUSPENSA_INSTANCIA), pergunta atual, **lock por entrevista** (Redis/advisory lock com fallback em memória nos testes), uma conversa ativa por candidato em cada empresa (as demais aguardam, sem retry correndo), **marco de início = primeira resposta** (áudio ou texto aceito; "Começar"/"1" não é início). Convite via `/send/menu` com aviso de tentativa única; cria `Resposta` (AUDIO_WHATSAPP com `mensagemIdProvedor`) e agenda `stt-transcricao`; agenda inatividade (F7-08) após cada resposta; última resposta → `CONCLUIDA` (candidatura `TRIAGEM_CONCLUIDA`). Usa o guarda da F7-12 e o decisor da F7-11.  
**Aceite:** candidato recebe o convite pelo número da empresa dona da vaga, responde 5 perguntas por áudio e a entrevista fica `CONCLUIDA` com áudios no S3 (MinIO/fake), transcrições e notas; o mesmo evento de webhook entregue duas vezes gera uma única resposta.

### 3.5 F7-05 — Monitoramento das instâncias

Job periódico (`whatsapp-monitoramento`, 5 min, `WHATSAPP_MONITOR_INTERVALO_MS`) em contexto de sistema: CONECTADA → desconectada ⇒ `DESCONECTADA`, `desconectadaEm`, notificação `WHATSAPP_DESCONECTADO` à empresa e aos admins da plataforma (dedup por queda), histórico de quedas (início/fim), entrevistas → `SUSPENSA_INSTANCIA` e retries congelados; reconexão por QR ⇒ `CONECTADA`, `ultimaConexaoEm`, **ressincronização do webhook** (`configurarWebhook` com `${API_PUBLIC_URL}/api/v1/webhooks/whatsapp/uazapi/<id>`), retomada com o tempo restante (o tempo desconectado não conta no prazo). Erro de uma instância não afeta as outras. Reaproveitar a transição em `WhatsappService.sincronizar`.  
**Aceite:** desconexão gera alerta à empresa e ao admin; envios e retries daquela empresa ficam pausados até a reconexão, sem consumir tentativas; outras empresas seguem normalmente.

### 3.6 F7-07 — Motor de retry

Jobs atrasados BullMQ (`triagem-retry`, `jobId` determinístico `retry:<entrevistaId>:<n>`), valores do ADR 0006 (Q7), horário comercial seg–sex 9h–18h America/Sao_Paulo (fora da janela → próximo horário válido), estados RETRY_N e `SEM_RESPOSTA` (não é reprovação; sinaliza decisão humana), **cadência humana** (atraso aleatório 3–8 s) e **rate limit por instância** (20/min, 200/h — implementar `LimitadorEnvio` com Redis + fake), congelamento na pausa da vaga (reagenda com tempo restante na retomada), cancelamento no fechamento, cancelamento ao chegar resposta, congelamento em `SUSPENSA_INSTANCIA`. Consumir os efeitos de vaga `SUSPENDER`/`REAGENDAR`/`CANCELAR` previstos no ADR 0005.  
**Aceite:** sem resposta, os retries saem nos intervalos configurados, só no horário comercial, e depois `SEM_RESPOSTA`; vaga pausada congela os retries; vaga fechada os cancela; envios respeitam o rate limit por instância (teste).

### 3.7 F7-11 — Tratamentos de borda

Decisor puro em `packages/domain` + efeitos: texto (Q8: pedir áudio uma vez, depois aceitar `TEXTO_WHATSAPP` sinalizado; "ok"/"oi"/dúvidas não contam), mídia inválida (informa e repete), vários áudios na janela (60 s) agregados, áudio curto (< 2 s) pede repetição sem consumir a pergunta, opt-out "PARAR" (revoga consentimento, cancela entrevistas daquela empresa — `RECUSADA`/`CANCELADA` — e envia uma única confirmação), mensagens sempre identificando a vaga (candidato com várias triagens na mesma empresa).  
**Aceite:** tabela de casos testada; opt-out bloqueia envios seguintes.

### 3.8 F7-10 — Avaliação da resposta por IA

Após `CONCLUIDA` da transcrição (costura `ia-avaliacao`): `LlmProvider` (`@scv/llm`, fake por padrão) com rubrica, evidências, saída validada por schema (Zod), versão do prompt registrada (`Avaliacao.modelo`, `versaoPrompt`), conteúdo do candidato delimitado; baixa confiança/transcrição falha → fora da média, revisão humana sem penalidade; respostas parciais (abandono) avaliadas e não respondidas sem nota.  
**Aceite:** entrevista concluída tem `Avaliacao` IA por resposta; nenhum dado sensível no prompt.

### 3.9 F7-13 — Telas da empresa (acompanhamento da triagem)

API: `GET /empresas/{id}/vagas/{vagaId}/triagens`, `GET /empresas/{id}/triagens/{entrevistaId}`, `GET .../respostas/{respostaId}/audio` (URL pré-assinada curta **com auditoria de acesso**, F3-08), `POST .../respostas/{respostaId}/revisao` (Avaliacao HUMANO substitui a IA na exibição); isolamento (empresa B → 404). Mobile: `app/(empresa)/empresa/vagas/[id]/triagens.tsx` e `app/(empresa)/empresa/triagens/[entrevistaId].tsx` (estado, retries, player de áudio — `expo-audio` compatível com o SDK ou `Linking.openURL` —, transcrição, nota, revisão); link a partir da tela da vaga. Não remover telas existentes.  
**Aceite:** empresa vê estado, retries, áudio, transcrição, nota e faz revisão; candidato nunca vê nota.

### 3.10 F7-14 — Testes com relógio simulado

Relógio injetável em todos os jobs/serviços; cenários: retry nos horários certos (incluindo fim de semana/fora do horário), pausa congela, timeout × resposta simultânea, webhook duplicado, instância desconectada não consome tentativas.  
**Aceite:** suíte determinística na CI.

### Critérios de aceite gerais da Fase 7 (§7.9)

- Convite pelo número da empresa dona da vaga; 5 perguntas por áudio → `CONCLUIDA` com áudios no S3, transcrições e notas.
- Sem resposta: retries nos intervalos, só no horário comercial, depois `SEM_RESPOSTA` (sem reprovação automática).
- Após a primeira resposta, nenhuma nova tentativa; inatividade → `ABANDONADA` com avaliação parcial.
- Vaga pausada congela os retries; vaga fechada os cancela.
- Instância desconectada: alerta à empresa e ao admin; envios/retries daquela empresa pausados até reconexão por QR, sem consumir tentativas; outras empresas normais.
- Sem instância conectada, a 1ª fase não começa (teste).
- Mensagem da instância A nunca vai para entrevista da empresa B (teste).
- Webhook duplicado gera uma única resposta.
- Rate limit por instância (teste).
- Nenhum envio sem opt-in registrado.

Ao concluir: atualizar ADR 0006, `docs/fase-7-entrevista-whatsapp.md` (guia no estilo da Fase 6) e STATUS; tirar o PR de draft; CI verde; merge squash.

---

## 4. Fase 8 — Entrevista IA por voz em tempo real (§7.10)

Branch `feat/f8-entrevista-voz` a partir da `main` após o merge da Fase 7. Tudo local: LiveKit via `infra/docker-compose.yml` (já existe serviço LiveKit) ou fake; nenhum teste chama LiveKit/OpenAI reais.

| ID    | Tarefa                                                                                                                                                                                                | Situação                                      |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| F8-01 | POC de latência                                                                                                                                                                                       | ✅ feita (POC 8.1 na `main`)                  |
| F8-02 | Arquitetura de voz (Q3) + ADR                                                                                                                                                                         | Registrar ADR 0007 provisório com Q3 (ver §7) |
| F8-03 | LiveKit local, token de sala de curta duração, egress de gravação para S3/MinIO (fake nos testes)                                                                                                     | A fazer                                       |
| F8-04 | Agente de voz (`apps/voice-agent`): entrada na sala, VAD, turnos, barge-in, pipeline streaming STT → LLM → TTS atrás de interfaces                                                                    | A fazer                                       |
| F8-05 | Roteiro: perguntas definidas, follow-ups limitados ao tema, guardrails                                                                                                                                | A fazer                                       |
| F8-06 | Cronômetro por pergunta no servidor (padrão + override; follow-ups contam; aviso antes de expirar; ao expirar: encerramento educado, `parcial`, `expirou`, `tempoUsado`; sem eliminação automática)   | A fazer                                       |
| F8-07 | Sessão e tentativa: aviso/aceite, unicidade candidatura+fase, saída voluntária → ABANDONADA, janela curta de reconexão (Q9) com cronômetro pausado, retomada de onde parou, bloqueio com vaga pausada | A fazer                                       |
| F8-08 | Transcrição completa por pergunta e pós-processamento (fila `voz-pos-sessao`)                                                                                                                         | A fazer                                       |
| F8-09 | Avaliação pós-entrevista por pergunta (rubrica, evidências, flags de expiração/parcial)                                                                                                               | A fazer                                       |
| F8-10 | Tela de voz no app (SDK LiveKit, tempo, aviso de expiração, reconexão, encerrar com confirmação)                                                                                                      | A fazer                                       |
| F8-11 | Pré-checagem de microfone/rede/permissões e aceite com consentimento de gravação                                                                                                                      | A fazer                                       |
| F8-12 | Tela da empresa: player da gravação, transcrição por pergunta, notas, revisão humana (acesso auditado)                                                                                                | A fazer                                       |
| F8-13 | Teste de carga de sessões simultâneas e fila de admissão (local, com fakes)                                                                                                                           | A fazer                                       |
| F8-14 | Exceção manual por queda involuntária (Q10) com auditoria                                                                                                                                             | A fazer (Q10 provisório)                      |
| F8-15 | Teste com usuários reais em redes variadas                                                                                                                                                            | ⏸️ **Renato — pulado**                        |

**Aceite (§7.10):** latência p50 < ~1 s medida localmente (registrar valores por etapa; staging fica para o Renato); a IA faz exatamente as perguntas definidas, na ordem, com follow-ups só dentro do tempo; ao expirar, encerra educadamente, salva `expirou = true` e avança; fechar o app consome a tentativa (ABANDONADA); queda menor que a janela reconecta na mesma sessão e continua; segunda tentativa rejeitada; gravação e transcrição completas para empresa/admin com acesso auditado.

---

## 5. Fase 9 — Ranqueamento (§7.11) e Fase 10 — Multiprocesso (§7.12)

### Fase 9 (branch `feat/f9-ranqueamento`)

| ID    | Tarefa                                                                                                      | Situação                                         |
| ----- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| F9-01 | Aprovar pesos/limiar (Q15); encaminhar Q16                                                                  | Usar Q15 provisório (§7); Q16 ⏸️ Renato/jurídico |
| F9-02 | Componentes de score em `packages/domain` (perfil, habilidades, currículo, LinkedIn presença, triagem, voz) | A fazer                                          |
| F9-03 | Dados ausentes, renormalização, completude, abandono/expiração/SEM_RESPOSTA (§9.2 do plano do sistema)      | A fazer                                          |
| F9-04 | Pesos por vaga (soma 100, validação) + tela de ajuste                                                       | A fazer                                          |
| F9-05 | Recálculo por eventos com debounce por vaga e `versaoAlgoritmo`                                             | A fazer                                          |
| F9-06 | Explicabilidade (`Score.explicacao`) e revisão humana substituindo a IA                                     | A fazer                                          |
| F9-07 | Ranking invisível: DTOs com lista branca + teste que percorre todos os endpoints do papel CANDIDATO         | A fazer                                          |
| F9-08 | Tela de ranking (empresa e admin) com explicação e filtros                                                  | A fazer                                          |
| F9-09 | Relatórios de viés (distribuição, concordância IA × humano, efeito das expirações)                          | A fazer                                          |
| F9-10 | Revisão de viés nos prompts de avaliação                                                                    | A fazer                                          |

**Aceite:** 6 componentes; sem fases, renormaliza e mostra completude; mudar pesos recalcula; revisão humana altera o score; o teste de ranking invisível falha se algum DTO do candidato tiver `score*`, `posicao`, `ranking`, `percentil` ou `totalCandidatos` (validado com campo injetado de propósito); candidato vê só status/fase.

### Fase 10 (branch `feat/f10-multiprocesso`)

| ID     | Tarefa                                                                                                                                | Situação               |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| F10-01 | Suíte completa de isolamento multi-tenant (todas as rotas e filas) + bypass admin auditado                                            | A fazer                |
| F10-02 | Concorrência: retry × resposta, pausa × sessão, fechamento × entrevista, webhooks duplicados                                          | A fazer                |
| F10-03 | Cotas e rate limits por tenant (API, IA, envios por instância, sessões de voz)                                                        | A fazer                |
| F10-04 | Autoscaling (somente configuração/documentação local; sem nuvem)                                                                      | A fazer (local)        |
| F10-05 | Testes de carga k6 locais (muitas empresas/vagas/candidatos)                                                                          | A fazer (local)        |
| F10-06 | Candidato em vários processos (empresas diferentes em paralelo; uma por vez na mesma empresa; uma sessão de voz por vez; UX da lista) | A fazer                |
| F10-07 | Painéis de capacidade e alertas (filas, sessões, instâncias, custo de IA) — local (Bull Board/endpoint de métricas)                   | A fazer                |
| F10-08 | Hardening e revisão de segurança (threat model, OWASP, segredos, acesso admin)                                                        | A fazer                |
| F10-09 | Runbooks (reconexão da instância, fila travada, latência de voz) e checklist do piloto                                                | A fazer                |
| F10-10 | Go/no-go do piloto                                                                                                                    | ⏸️ **Renato — pulado** |

**Aceite:** carga com várias empresas/processos sem perda de mensagens nem estados inconsistentes e latência de voz dentro da meta; acesso cruzado → 403/404 em 100% das rotas testadas; cotas por tenant sem afetar outros; candidato em 3 processos recebe as triagens em sequência com a vaga identificada.

---

## 6. Tarefas do Renato (não executar — marcar pendente/pulada no STATUS)

| ID                | Motivo                                                          |
| ----------------- | --------------------------------------------------------------- |
| F6-01             | Credenciais de push e decisão Q17                               |
| F7-01             | Instância Uazapi de teste em staging (QR, webhook, limites)     |
| F7-02             | Decisão final de Q2/Q7/Q8/Q19 (usar os provisórios do ADR 0006) |
| F7-15             | Teste ponta a ponta com o número real                           |
| F8-15             | Teste com usuários reais em redes variadas                      |
| F9-01 (aprovação) | Aprovar pesos/limiar (usar provisório)                          |
| F10-10            | Go/no-go do piloto                                              |
| Q16               | LGPD art. 20 (Renato + jurídico)                                |
| Q18               | Prazos de retenção (Renato + jurídico)                          |

---

## 7. Decisões provisórias a usar (registrar em ADRs, marcadas "Provisório — revisável pelo Renato")

| #   | Decisão provisória                                                                                                                                                                                                                                                                                                          | ADR                  |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Q2  | STT da 1ª fase: **Whisper via API** (`whisper-1`) atrás de `SttProvider`; fake é o padrão em dev/test; real só com `STT_PROVIDER=openai` e `OPENAI_API_KEY`                                                                                                                                                                 | 0006 (já registrado) |
| Q7  | Retry com os valores sugeridos do plano §8.5.2: 3 retries (4 envios), intervalo 24 h, prazo total 96 h (congelado na pausa), seg–sex 9h–18h America/Sao_Paulo, inatividade após início 24 h → ABANDONADA, 1 lembrete na metade (12 h); cadência 3–8 s aleatórios; rate limit inicial 20 msgs/min e 200 msgs/h por instância | 0006 (já registrado) |
| Q8  | Pedir áudio uma vez; texto repetido para a mesma pergunta é aceito como `TEXTO_WHATSAPP` sinalizado para revisão; "ok"/"oi"/dúvidas não contam                                                                                                                                                                              | 0006 (já registrado) |
| Q19 | Padrão do plano: avanço da 1ª para a 2ª fase **manual** (o sistema só recomenda — §9.5)                                                                                                                                                                                                                                     | 0006 (já registrado) |
| Q21 | Verificação do número por **confirmação no primeiro contato pela instância da empresa** (sem SMS/OTP), mais opt-in no app                                                                                                                                                                                                   | 0006 (já registrado) |
| Q3  | Arquitetura validada pela POC 8.1: **pipeline modular STT → LLM → TTS em streaming** sobre LiveKit (self-hosted local via docker-compose), provedores atrás de interfaces (`SttProvider`, `LlmProvider`, TTS), fakes nos testes; speech-to-speech fica como alternativa futura                                              | criar 0007 (Fase 8)  |
| Q9  | **Janela curta de reconexão** na mesma sessão (padrão 60 s, configurável) com o **cronômetro da pergunta pausado** durante a queda; após a janela → ABANDONADA                                                                                                                                                              | 0007                 |
| Q10 | **Exceção manual** por queda involuntária concedida por empresa/admin (`Entrevista.excecaoConcedida`), uma vez por entrevista, com **auditoria** obrigatória (quem, quando, motivo)                                                                                                                                         | 0007                 |
| Q15 | Pesos padrão do plano §9.1 (perfil 10, habilidades 25, currículo 10, LinkedIn 2, triagem 23, voz 30) e limiar de match forte **0,75** (já usado em `MATCH_LIMIAR_FORTE`, ADR 0005)                                                                                                                                          | criar 0008 (Fase 9)  |
| Q20 | **Somente local** (sem hospedagem/região/GPU nesta etapa)                                                                                                                                                                                                                                                                   | registrar em 0007    |

---

## 8. Checklist por fase (para o agente)

1. Criar/continuar a branch da fase; ler o plano da fase e os ADRs.
2. Implementar tarefa a tarefa (ordem das dependências), commit + push após cada uma, atualizar STATUS.
3. Rodar `pnpm lint && pnpm typecheck && pnpm test && pnpm build` + suíte Prisma/RLS local antes de cada push.
4. Abrir/atualizar o PR (descrição: o que muda, como testar, critérios de aceite marcados, riscos, agente autor e modelo).
5. CI verde (rerun de flaky) → merge **squash** → atualizar a `main` local → próxima fase.
6. Ao final de tudo: STATUS com todas as fases, lista de pendências do Renato e ADRs provisórios a aprovar.
