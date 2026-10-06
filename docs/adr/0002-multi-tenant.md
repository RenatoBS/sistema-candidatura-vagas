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
