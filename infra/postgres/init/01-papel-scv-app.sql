-- Papel de runtime da aplicação (ADR 0002): não é superusuário e NÃO tem BYPASSRLS, então o RLS vale.
-- O papel `scv` (POSTGRES_USER) continua sendo o dono do schema e roda as migrações.
-- Roda só na primeira inicialização do volume. Em ambiente existente: `docker compose down -v` ou
-- execute este arquivo manualmente com `psql -U scv -d scv -f infra/postgres/init/01-papel-scv-app.sql`.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'scv_app') THEN
    CREATE ROLE scv_app LOGIN PASSWORD 'scv_app_dev_password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END
$$;

DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO scv_app', current_database());
END
$$;

GRANT USAGE ON SCHEMA public TO scv_app;

-- Tudo o que o dono (POSTGRES_USER, que roda as migrações) criar daqui em diante já nasce acessível
-- ao papel de runtime.
DO $$
BEGIN
  EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO scv_app', current_user);
  EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO scv_app', current_user);
  EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO scv_app', current_user);
END
$$;
