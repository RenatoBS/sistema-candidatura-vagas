# Relatório de testes locais — 2026-10-07

**Ambiente:** macOS, infra do `infra/docker-compose.yml` (Postgres+pgvector, Redis, MinIO, Mailpit, LiveKit), API, workers e app web (Expo, `http://localhost:8081`) rodando localmente, `.env` com chaves reais de OpenAI e Uazapi.
**Escopo:** gates de qualidade, testes E2E da API (curl/scripts), app web nas três visões (candidato, empresa, admin) e integrações reais (OpenAI, Uazapi, OCR).
**Plano de correção:** [`docs/plano-correcoes.md`](plano-correcoes.md).

Legenda de severidade: **CRÍTICO** (vazamento entre empresas/segurança), **ALTO** (fluxo principal bloqueado), **MÉDIO** (funciona com defeito), **BAIXO** (UX/cosmético).

---

## 1. Gates de qualidade

| Gate | Resultado |
|------|-----------|
| `pnpm lint` | OK |
| `pnpm typecheck` | OK |
| `pnpm build` | OK |
| `pnpm test` | OK — api 71, domain 94, workers 16, mobile 12, llm 3, voice-agent 3, contracts 1, providers 37, prisma 12 (em banco `scv_test`) |
| `pnpm format:check` | 221 arquivos fora do Prettier (não roda na CI) |
| gitleaks | Falso positivo em `docs/plano-sistema.md:257` (regra `linkedin-client-id`) — pode quebrar o job de segredos |

Observação: os testes da API usam repositórios em memória, por isso não pegam bugs que só aparecem com Prisma/Postgres (RLS, filtros por `empresaId`, UUID inválido → 500).

---

## 2. O que funciona

**Autenticação e conta**
- Cadastro, confirmação de e-mail, login, refresh com rotação e detecção de reuso, recuperação de senha, reautenticação.
- MFA do admin: cadastro do autenticador, códigos de recuperação, validação e entrada na área admin.

**Candidato**
- Perfil (carregar/salvar), habilidades, consentimentos, privacidade, preferências de notificação.
- Upload de CV (URL pré-assinada no MinIO), OCR local com Tesseract `por+eng`, extração de habilidades com IA.
- Lista e detalhe de vagas públicas, candidatura com consentimento, convites (aceitar/recusar), notificações.
- Ranking invisível: nenhum DTO do candidato expõe score, posição ou total.
- Exportação e exclusão LGPD (anonimização da conta).

**Empresa**
- Auto-cadastro, verificação, convite de membros, moderação pelo admin com reautenticação.
- Isolamento nas rotas `/empresas/:empresaId/*` (a maioria checa o vínculo corretamente).
- Vagas: criar, editar prazo, pausar/retomar, prorrogar, fechar, duplicar, com validações de ciclo de vida.
- Definir processo seletivo; sugerir perguntas com IA (OpenAI); aceitar/descartar sugestões.
- Match por embeddings (OpenAI), recálculo de ranking e pesos, tela de ranking.
- WhatsApp (Uazapi real): criar instância, gerar QR, consultar status, desconectar; monitor detecta desconexão.
- Triagem: guardas de início; avaliação com LLM.
- Notificações e preferências; dispositivos de push.
- Troca de visão candidato ⇄ empresa (conta dual).

**Admin**
- Lista de empresas, fila de verificação, auditoria, instâncias WhatsApp (todas carregam).

**Voz (Fase 8)**
- Rotas e pipeline fake funcionam; POC com mock em ~906 ms. LiveKit real e agente de voz ainda são stub (documentado em `docs/STATUS.md`).

---

## 3. O que não funciona

### 3.1 Segurança e multi-tenant

| # | Sev. | Problema | Onde |
|---|------|----------|------|
| S1 | CRÍTICO | `GET /admin/auditoria` e `GET /admin/whatsapp/instancias` aceitam **qualquer membro de empresa** e devolvem dados de **todas** as empresas (as permissões `consultar_auditoria`/`ver_status_whatsapp` valem para EMPRESA e o serviço consulta com `isAdmin: true`). | `apps/api/src/http/auditoria.controller.ts`, `apps/api/src/whatsapp/whatsapp.service.ts` (`listarAdmin`), `packages/domain/src/permissoes.ts` |
| S2 | CRÍTICO | Empresa A lista candidaturas de vaga da empresa B (`GET /vagas/:id/candidaturas`). | `candidaturas.service.ts` (`daVaga`) |
| S3 | CRÍTICO | Empresa A convida candidato para vaga da empresa B. | `candidaturas.service.ts` (`convidar`) |
| S4 | CRÍTICO | IDOR no detalhe de vaga de outra empresa. | `vagas.service.ts` (`obter` sem `exigirVaga`) |
| S5 | CRÍTICO | IDOR ao remover/alterar membro de outra empresa (update sem filtro de `empresaId`). | `apps/api/src/repositorio/prisma.ts` (`atualizarMembro`) |
| S6 | CRÍTICO | Tela admin de verificação usa o campo **"Motivo" como senha** da reautenticação e depois envia o mesmo texto como motivo: a senha do admin vai para a auditoria. | `apps/mobile/app/(admin)/admin/verificacoes.tsx` |
| S7 | ALTO | Usuário do banco `scv` é superuser/BYPASSRLS: localmente o RLS não protege nada. O papel `scv_app` (ADR 0002) não existe no compose e não há testes HTTP de acesso cruzado contra Postgres. | `infra/docker-compose.yml`, `prisma/test/` |
| S8 | ALTO | Logs em texto claro de `x-internal-token`, `x-reauth-token` e `x-webhook-secret`. | `apps/api/src/app.module.ts` (redact do pino) |
| S9 | MÉDIO | Código TOTP pode ser reutilizado na mesma janela. | `apps/api/src/auth/mfa.service.ts` |
| S10 | MÉDIO | Leituras com bypass de admin não são auditadas. | serviços com `isAdmin: true` |

### 3.2 Fluxos bloqueados

| # | Sev. | Problema | Onde |
|---|------|----------|------|
| F1 | ALTO | Token de empresa sai com `empresaId: null` no login e no refresh. Efeitos vistos no app: **Sugestões de match → 403** (tela presa em "Carregando…"), **convidar por sugestão → 403**, **tela Membros quebrada** (`GET /empresas//membros` → 404). A troca de visão corrige até a próxima renovação do token. | `apps/api/src/auth/auth.service.ts` (login/refresh passam `null`), `apps/mobile/app/(empresa)/empresa/membros.tsx` |
| F2 | ALTO | **Não é possível publicar vaga nova pelo app.** O processo padrão cria 2 etapas com 5 perguntas (triagem WhatsApp e entrevista por voz), mas a tela só gerencia a 1ª etapa; a publicação exige todas aprovadas e sem sugestões pendentes. Erro mostrado: "aprove todas as perguntas da etapa", sem dizer qual etapa nem quantas faltam. | `apps/mobile/app/(empresa)/empresa/vagas/[id]/index.tsx`, `vagas.service.ts` (`publicar`) |
| F3 | ALTO | Webhook da Uazapi sempre 401: o segredo `x-webhook-secret` não é enviado ao configurar a instância e a URL usa `localhost` (inalcançável pela Uazapi). Mensagens do candidato nunca chegam. | `packages/providers/src/uazapi-instancia.ts`, `webhook-uazapi.service.ts`, `triagem-monitor.service.ts` |
| F4 | ALTO | Checagem de CNPJ sempre `INDISPONIVEL`: BrasilAPI devolve 403 sem `User-Agent`. | `packages/providers/src/cnpj.ts` |
| F5 | MÉDIO | Sugestões de perguntas com IA duplicadas (geração síncrona + job) — 9 sugestões quase iguais em vez de 5, e é preciso descartar uma a uma para publicar. | `vagas`/`perguntas` service + worker de sugestões |
| F6 | MÉDIO | `GET ranking/vies` → 500. | módulo de ranking |
| F7 | MÉDIO | Job de encerrar inscrições marcado como *failed* (tenta remover o próprio job travado). | `apps/workers` |
| F8 | MÉDIO | Iniciar triagem → 500 quando o envio pelo WhatsApp falha, e o convite nunca é reenviado. | `triagem` service |
| F9 | MÉDIO | `registrarAceite` ignora entrevista suspensa; depois o esgotamento marca `SEM_RESPOSTA`. | `triagem` service |
| F10 | MÉDIO | Alertas de WhatsApp desconectado não aparecem na central de notificações. | `notificacoes-prisma.ts` (filtro de tipos) |
| F11 | MÉDIO | Variáveis de ambiente vazias quebram defaults (`env.X ?? 'padrão'` não trata `""`); ex.: `LLM_MODELO=` → sugestões de IA 500. | `packages/llm/src/fabrica.ts` e afins |

### 3.3 Validação e erros da API (500 onde deveria ser 4xx)

| # | Sev. | Problema |
|---|------|----------|
| V1 | MÉDIO | Remover membro inexistente → 500. |
| V2 | MÉDIO | `vagas-publicas` com UUID ou enum inválido → 500. |
| V3 | MÉDIO | Filtro global de erros não loga a exceção original (500 sem rastro). |
| V4 | MÉDIO | Único admin da empresa consegue remover a si mesmo. |
| V5 | BAIXO | Exceção em entrevista já concluída → 404 (deveria 409). |
| V6 | BAIXO | Publicar vaga `FECHADA` devolve erro errado. |
| V7 | BAIXO | `completudeMin` aceita valores fora do intervalo. |
| V8 | BAIXO | Entrevista por voz pode ser criada sem triagem concluída. |

### 3.4 LGPD e privacidade

| # | Sev. | Problema |
|---|------|----------|
| L1 | ALTO | Exclusão LGPD deixa transcrições, áudios no S3 e embeddings. |
| L2 | MÉDIO | Rota de áudio do admin devolve a chave S3 crua em vez de URL assinada. |
| L3 | BAIXO | Limpeza de dispositivos de push nunca é agendada. |
| L4 | BAIXO | Logout não invalida o access token até expirar. (decisão do Renato) |
| L5 | BAIXO | Login permitido antes de confirmar e-mail. (decisão do Renato) |

### 3.5 App (UI/UX)

| # | Sev. | Problema | Tela |
|---|------|----------|------|
| U1 | MÉDIO | Lista de candidaturas mostra "Vaga" em vez do título (DTO só tem `vagaId`). | candidato/candidaturas |
| U2 | MÉDIO | Tela de currículo não lista CVs existentes: um CV não confirmado não pode ser confirmado depois. | candidato/curriculo |
| U3 | MÉDIO | Detalhe de vaga com convite pendente mostra "já se candidatou" e não oferece aceitar. | candidato/vaga |
| U4 | MÉDIO | Candidatos e ranking da vaga não mostram nome/identificação do candidato ("Candidato"); completude aparece como `0.6666666666666666`. | empresa/candidatos, ranking |
| U5 | MÉDIO | Consulta com 403/404 fica em "Carregando…" durante as novas tentativas (o hook repete erros 4xx). | `apps/mobile/src/hooks/useConsulta.ts` |
| U6 | MÉDIO | Admin: lista de empresas é só leitura (sem suspender/reativar); MFA mostra a URI `otpauth://` crua em vez de QR code e não avança após confirmar. | admin/empresas, /mfa |
| U7 | BAIXO | Privacidade com toggles duplicados ("Visível para match" / "Visibilidade para match"). | candidato/privacidade |
| U8 | BAIXO | Nova vaga: senioridade e modelo são texto livre (deveriam ser seletores); rótulo "Prazo" duplicado no detalhe. | empresa/vagas |
| U9 | BAIXO | Datas em ISO cru ("Última conexão: 2026-10-07T12:25:46.768Z"). | empresa/whatsapp, admin/whatsapp |
| U10 | BAIXO | Campos de texto sem rótulo acessível (leitores de tela leem só o valor). | geral |

### 3.6 Ambiente local / infra

| # | Problema |
|---|----------|
| I1 | Imagem `minio/minio:latest` não está mais disponível; localmente foi usada `pgsty/silo:latest` com a mesma tag. |
| I2 | Nenhum serviço cria o bucket `scv-dev` (criado à mão). |
| I3 | `ffmpeg` ausente no host bloqueia a transcrição de áudio; Tesseract + `por.traineddata` e `poppler` também precisam ser instalados (não documentado). |
| I4 | Seeds gravam hashes argon2 de placeholder: nenhum usuário de seed consegue logar (a API usa bcrypt). |
| I5 | Expo reescreve `apps/mobile/tsconfig.json` e apaga `expo-env.d.ts` ao subir. |

### 3.7 Por design (fora deste plano)

LiveKit com token fake, agente de voz stub e score de voz heurístico — já documentados em `docs/STATUS.md`.

---

## 4. Dados de teste deixados no banco local

- Vagas criadas pelos testes ("… E2E", "Vaga Teste Web" em rascunho), candidatura `CONVIDADA` `36b1abe2…` criada no teste de acesso cruzado.
- Usuários e empresas `E2E <timestamp>`; CV "Maria Teste".
- Instância Uazapi `r32a86895e24349` (desconectada) na conta do Renato.
- Banco `scv_test` (usado pelos testes Prisma).
- Senha de todos os usuários de seed: `Senha123`. O MFA de `admin-sem-mfa@scv.dev` foi resetado para cadastro próprio.
