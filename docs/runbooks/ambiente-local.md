# Runbook — ambiente local

Passo a passo para subir o projeto do zero numa máquina de desenvolvimento (macOS/Linux).

## 1. Dependências do host

| Ferramenta | Para quê | macOS (Homebrew) |
|------------|----------|------------------|
| Node ≥ 20, pnpm 10 | monorepo | `brew install node pnpm` |
| Docker + Compose | Postgres, Redis, MinIO, Mailpit, LiveKit | Docker Desktop / OrbStack |
| `ffmpeg` | converte áudio do WhatsApp antes da transcrição (sem ele a transcrição não roda) | `brew install ffmpeg` |
| `tesseract` + `por.traineddata` | OCR local de currículos (`por+eng`) | `brew install tesseract tesseract-lang` |
| `poppler` (`pdftoppm`) | PDF → imagem para o OCR | `brew install poppler` |

Confira: `ffmpeg -version`, `tesseract --list-langs` (deve listar `por` e `eng`) e `pdftoppm -v`.
As variáveis `TESSERACT_BIN` e `PDFTOPPM_BIN` do `.env` apontam para os binários, se não estiverem no `PATH`.

## 2. Infra com Docker Compose

```bash
cp .env.example .env          # preencha os placeholders e ajuste JWT_SECRET, APP_ENCRYPTION_KEY, INTERNAL_JOB_TOKEN
docker compose -f infra/docker-compose.yml up -d
```

O `up -d` do zero já entrega tudo pronto, sem passo manual:

- **Postgres** (`pgvector/pgvector:pg16`) exige `POSTGRES_PASSWORD` e `SCV_APP_DB_PASSWORD` e cria o papel de runtime **`scv_app`** (sem superuser, sem `BYPASSRLS`) pelo script `infra/postgres/init/01-papel-scv-app.sh`. Ele só roda na **primeira** inicialização do volume; em ambiente existente, rode `docker compose -f infra/docker-compose.yml down -v` (apaga os dados locais) ou execute o script à mão como `postgres`, com as variáveis definidas: `docker compose -f infra/docker-compose.yml exec -u postgres -e POSTGRES_USER="$POSTGRES_USER" -e POSTGRES_DB="$POSTGRES_DB" -e SCV_APP_DB_PASSWORD="$SCV_APP_DB_PASSWORD" postgres /docker-entrypoint-initdb.d/01-papel-scv-app.sh`.
- **MinIO** exige `MINIO_ROOT_USER` e `MINIO_ROOT_PASSWORD`; o worker também exige `S3_ACCESS_KEY` e `S3_SECRET_KEY` (normalmente os mesmos valores). Não há credenciais padrão no Compose.
- **MinIO** usa imagem **fixada por versão** (`pgsty/minio`, fork mantido). As imagens oficiais `minio/minio` e `quay.io/minio/minio` deixaram de ser publicadas; nunca use `:latest`.
- **`minio-init`** (`pgsty/mc`) cria o bucket `scv-dev` de forma idempotente e termina. Console do MinIO em `http://localhost:9001`.

## 3. Banco: dois papéis, duas URLs

| Variável | Papel | Uso |
|----------|-------|-----|
| `MIGRATION_DATABASE_URL` | `scv` (dono do schema) | `prisma migrate`, seed e testes de migração |
| `DATABASE_URL` | `scv_app` (runtime) | API — o RLS vale para este papel (os workers falam com a API por HTTP, sem conexão própria com o banco) |

Em desenvolvimento, `DATABASE_URL` usa `scv_app`: assim o RLS protege de verdade e bugs de isolamento aparecem localmente. Defina `SCV_APP_DB_PASSWORD` e use a mesma senha na URL. Conferir:

```sql
select rolsuper, rolbypassrls from pg_roles where rolname = current_user;  -- false, false
```

Migrar e popular:

```bash
pnpm --filter @scv/prisma db:migrate:deploy   # usa MIGRATION_DATABASE_URL
pnpm --filter @scv/prisma db:seed
```

### Usuários do seed

Todos os usuários do seed têm a senha **`Senha123`** (hash bcrypt, o mesmo da API) e e-mail já confirmado: `admin@scv.dev`, `admin-sem-mfa@scv.dev` (cadastra o próprio MFA), `dual@scv.dev`, `candidato@scv.dev`, `recrutador-a@empresa-a.dev`, `recrutador-b@empresa-b.dev`, além do admin de cada empresa de exemplo. **Só para desenvolvimento.**

A API confere o papel ao subir: superuser/BYPASSRLS **impede o boot em produção** e gera aviso em desenvolvimento.

### Ambiente já existente (volume antigo)

O init só roda em volume novo. Para quem já tem o Postgres local: defina `SCV_APP_DB_PASSWORD` e crie o papel uma vez com
`docker compose -f infra/docker-compose.yml exec -u postgres -e POSTGRES_USER="$POSTGRES_USER" -e POSTGRES_DB="$POSTGRES_DB" -e SCV_APP_DB_PASSWORD="$SCV_APP_DB_PASSWORD" postgres /docker-entrypoint-initdb.d/01-papel-scv-app.sh`, e no `.env` troque
`DATABASE_URL` para o usuário `scv_app` (ver `.env.example`) e adicione `MIGRATION_DATABASE_URL` com o usuário `scv`.

## 4. Testes que tocam o banco

Os testes de `prisma/test` e de `apps/api/test-prisma` fazem `DROP SCHEMA public CASCADE`. Use **sempre** um banco descartável cujo nome termina em `_test` (`scv_test`), nunca o `scv`:

```bash
docker exec scv-postgres psql -U scv -d postgres -c "create database scv_test"
U="$SCV_TEST_DATABASE_URL"
MIGRATION_DATABASE_URL=$U DATABASE_URL=$U pnpm --filter @scv/prisma test
SCV_TEST_DATABASE_URL=$U pnpm --filter @scv/api test:prisma   # recusa bancos que não terminam em _test; cria o scv_app, sobe a API como ele e roda a suíte de acesso cruzado
```

## 5. Variáveis de ambiente vazias

`LLM_MODELO=` (vazio) no `.env` **não** quebra os padrões: o código lê variáveis com `envOu`/`envNumero` de `@scv/env`, que tratam vazio/só espaços como ausente. Use esses helpers em qualquer variável nova; não use `env.X ?? 'padrão'`.

## 6. Webhook da Uazapi

Ver [webhook-uazapi-dev.md](webhook-uazapi-dev.md): a Uazapi precisa alcançar a API por um túnel, e `UAZAPI_WEBHOOK_SECRET` é obrigatório quando `UAZAPI_*` está configurado.

## 7. Expo reescrevendo `tsconfig.json`

Sintoma antigo: ao rodar `expo start`, o `apps/mobile/tsconfig.json` mudava e o `expo-env.d.ts` sumia. Causa: com `typedRoutes` desligado o Expo remove `expo-env.d.ts` e `.expo/types/**` do `include` e apaga o arquivo. Correção: os tipos globais do Expo ficam em `apps/mobile/src/tipos-expo.d.ts` e o `include` é só `**/*.ts` e `**/*.tsx`. Se o `git status` voltar a mostrar mudança em `apps/mobile/tsconfig.json` depois do `expo start`, reverta e investigue — não deveria acontecer.

## 8. Segredos

Nunca commite `.env`. A CI roda gitleaks; a única exceção é o falso positivo da palavra "LinkedIn" na tabela de módulos de `docs/plano-sistema.md` (`.gitleaks.toml`, restrita a essa linha desse arquivo).
