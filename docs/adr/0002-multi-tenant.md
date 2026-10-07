# ADR 0002 — Modelo multi-tenant com RLS

**Status:** Aceito  
**Data:** 2026-10-06  
**Aprovado por:** Renato Souza (F2-02, 2026-10-06)  
**Autor:** Cursor (Composer)

## Contexto

A plataforma atende múltiplas empresas (tenants) no mesmo banco PostgreSQL. Cada empresa publica vagas, conduz triagens pelo próprio WhatsApp (instância Uazapi) e acessa candidaturas e avaliações **somente dos seus processos**. O admin da plataforma (`ADMIN_PLATAFORMA`) precisa de visão cruzada para suporte, moderação e auditoria — sempre com MFA e trilha de acesso.

O [plano do sistema](../plano-sistema.md) §11.2 e o [plano de implementação](../plano-implementacao.md) §7.4 (F2-01) definem isolamento por `empresaId` com Row-Level Security (RLS) no banco e bypass controlado no aplicativo.

## Decisão

### 1. Coluna `empresaId` em tabelas de domínio do tenant

Tabelas que pertencem a uma empresa carregam `empresaId` (UUID, FK para `Empresa`, indexada). Exemplos: `Vaga`, `ProcessoSeletivo`, `Pergunta` (banco por empresa), `Candidatura`, `Entrevista`, `Resposta`, `InstanciaWhatsapp`, `Notificacao` (quando contextual), `AuditoriaAcesso`, `VerificacaoEmpresa`, `MembroEmpresa`.

Tabelas **globais** (sem `empresaId` direto): `Usuario`, `Empresa` (raiz do tenant), `Habilidade` (catálogo), `Candidato` e derivados de perfil (`Curriculo`, `CandidatoHabilidade`, `Consentimento`). O acesso da empresa a dados de candidato ocorre **via** `Candidatura` / convite de match, nunca por leitura direta do perfil global de outro processo.

### 2. Row-Level Security (RLS) no PostgreSQL

- Habilitar RLS em todas as tabelas com `empresaId` e em `Empresa`.
- Política padrão (SELECT/INSERT/UPDATE/DELETE):

```sql
current_setting('app.is_admin', true) = 'true'
OR "empresaId" = NULLIF(current_setting('app.empresa_id', true), '')::uuid
```

- Tabelas filhas sem `empresaId` (ex.: `Etapa`, `EtapaPergunta`, `SessaoVoz`, `MensagemWhatsapp`, `Avaliacao`, `Score`, `HistoricoStatus`) usam política por **subconsulta** ao ancestral com `empresaId` (ex.: `ProcessoSeletivo`, `Entrevista`, `Candidatura`).
- O papel de banco da aplicação (`scv_app`) **não** é superusuário; RLS aplica-se a ele.
- Migrações e seeds rodam com papel elevado (`BYPASSRLS` ou conexão de migração sem RLS) apenas em pipelines controlados.

### 3. Contexto de sessão (`app.*`)

Antes de cada transação de negócio, o backend define (via `SET LOCAL` dentro da transação):

| Variável | Valor |
|----------|--------|
| `app.empresa_id` | UUID da empresa ativa (`X-Empresa-Id` ou contexto do worker) |
| `app.is_admin` | `'true'` somente se papel `ADMIN_PLATAFORMA` **e** MFA validado na sessão |

Funções auxiliares SQL: `app_current_empresa_id()`, `app_is_admin()`.

### 4. Bypass do admin — somente com MFA

- `app.is_admin = true` é setado **exclusivamente** pelo `TenantGuard` / middleware de auth após validar JWT + papel + desafio MFA concluído.
- Bypass permite leitura/escrita cruzada; **todo** acesso a áudio, gravação e transcrição por admin gera registro em `AuditoriaAcesso` (Fase 3).
- Admin **sem** MFA: `app.is_admin` permanece `false` → RLS bloqueia dados de outras empresas (0 linhas).

### 5. Extensão Prisma de tenant

Pacote `@scv/prisma` exporta `createTenantPrisma()` que:

1. Envolve o cliente Prisma com middleware de transação.
2. Executa `SET LOCAL app.empresa_id` e `SET LOCAL app.is_admin` no início de cada `$transaction`.
3. Documenta modelos que exigem filtro explícito quando não há `empresaId` (ex.: leitura de `Candidato` só via join autorizado).

A camada de aplicação (NestJS `TenantGuard`, workers com `empresaId` no payload) é a **fonte de verdade** para definir o contexto; a RLS é a **última barreira** no banco.

### 6. Testes obrigatórios (F2-10)

- Usuário/membro da empresa A não lê linhas da empresa B (0 linhas pela RLS).
- Sessão de admin com MFA (`app.is_admin = true`) lê ambas.
- Admin sem MFA não obtém bypass.

### 7. Atualização 2026-10-07 — o RLS só vale se o runtime usar `scv_app` (FC-03)

O teste local de 2026-10-07 (S7) mostrou que o usuário do banco `scv` era superuser/BYPASSRLS: localmente o RLS não protegia nada e nenhum teste HTTP rodava contra Postgres. O procedimento passa a ser:

- **Dois papéis, duas URLs.** `DATABASE_URL` = `scv_app` (a API; sem superuser, sem BYPASSRLS — os workers falam com a API por HTTP e não abrem conexão com o banco). `MIGRATION_DATABASE_URL` = `scv` (dono do schema; migrações, seed e reset). Os scripts `db:*` de `@scv/prisma` usam a URL de migração (`prisma/scripts/prisma-migracao.mjs`).
- **O papel nasce com o ambiente.** `infra/postgres/init/01-papel-scv-app.sql` (montado no compose) cria `scv_app` com `NOSUPERUSER NOBYPASSRLS` e privilégios padrão sobre o que o dono criar. Em produção, o IaC faz o equivalente.
- **Checagem de boot.** A API consulta `pg_roles` ao subir: papel superuser/BYPASSRLS **impede o boot em produção** e emite aviso fora dela (`apps/api/src/repositorio/papel-runtime.ts`).
- **Testes contra Postgres como `scv_app`** (`pnpm --filter @scv/api test:prisma`, job `api-postgres` da CI):
  1. o papel de runtime não é superuser nem tem BYPASSRLS e a API (não só o teste) conecta como ele;
  2. para **toda** tabela com `empresaId` (17 hoje), a empresa B não vê linha da empresa A, nem sem contexto; B não insere, atualiza nem apaga dados da A; admin com `is_admin` vê tudo;
  3. suíte HTTP de acesso cruzado que itera as **rotas realmente registradas** no Express: membro da empresa B, candidato e o inverso (A → B) recebem 400/403/404 em toda rota `empresas/:empresaId/*` e `vagas/:vagaId/*`; membro de empresa recebe 403 em toda rota `admin/*`; outro candidato não alcança candidaturas, convites, CVs, notificações nem voz alheios.
- **Defesa em profundidade na aplicação.** `escopoTenant(ctx)` (`apps/api/src/repositorio/escopo.ts`) filtra por `empresaId` as leituras/atualizações por `id` nos repositórios Prisma de vaga, pergunta, processo, evento, candidatura, entrevista, membro e convite, de modo que um papel que ignore RLS (ex.: conexão mal configurada) continua isolado.
- **Experimento de controle (registrado na PR do FC-03).** Removendo as checagens do FC-02 (`exigirMesmaEmpresa`, `escopoTenant`, comparação de empresa em `exigirVaga`), a suíte **continua verde** com `scv_app` (o RLS bloqueia sozinho). Repetindo com a API conectada como superuser, a suíte **falha** em `GET vagas/:vagaId/candidaturas` (200, vazamento) e `POST vagas/:vagaId/sugestoes-match/:id/convidar` — exatamente S2/S3. Ou seja, a suíte detecta os dois cenários.
- **Fora do RLS por desenho.** `usuarios`, `candidatos`, `candidatos_habilidades`, `consentimentos`, `curriculos`, `dispositivos_push`, `refresh_tokens`, `codigos_recuperacao_mfa`, `solicitacoes_lgpd` e `habilidades` não têm `empresaId`; o isolamento é por usuário na camada de aplicação (a suíte de acesso cruzado cobre o lado do candidato).

## Alternativas consideradas

| Alternativa | Motivo de rejeição |
|-------------|-------------------|
| Schema por empresa | Complexidade operacional, migrações N vezes |
| Isolamento só na aplicação | Risco de vazamento por query esquecida ou bug em worker |
| Views por tenant | Duplicação de schema, pior para Prisma |
| Discriminator sem RLS | Mesmo risco de bypass acidental |

## Consequências

- **Positivas:** defesa em profundidade; workers e API compartilham a mesma regra; testes de isolamento reproduzíveis na CI.
- **Negativas:** políticas em tabelas filhas mais verbosas; necessidade de `SET LOCAL` em toda transação; seeds e migrações precisam de papel adequado.
- **Implementação:** o schema da Fase 2 segue esta decisão (colunas, índices, migração RLS). Aprovado pelo Renato em 2026-10-06; fases 3+ dependem deste ADR.

## Referências

- [Plano do sistema §11.2](../plano-sistema.md)
- [Plano de implementação §7.4](../plano-implementacao.md)
- [ADR 0001 — Contexto inicial](0001-contexto-inicial.md)
