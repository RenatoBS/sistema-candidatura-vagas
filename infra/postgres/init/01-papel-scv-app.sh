#!/bin/sh
set -eu

: "${SCV_APP_DB_PASSWORD:?SCV_APP_DB_PASSWORD deve ser definida e não pode estar vazia}"

psql -v ON_ERROR_STOP=1 --set=app_password="$SCV_APP_DB_PASSWORD" <<'SQL'
SELECT format(
  'CREATE ROLE scv_app LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS',
  :'app_password'
)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'scv_app')\gexec

SELECT format('GRANT CONNECT ON DATABASE %I TO scv_app', current_database())\gexec
GRANT USAGE ON SCHEMA public TO scv_app;

-- Tudo o que o dono (POSTGRES_USER, que roda as migrações) criar daqui em diante já nasce acessível
-- ao papel de runtime.
ALTER DEFAULT PRIVILEGES FOR ROLE CURRENT_USER IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO scv_app;
ALTER DEFAULT PRIVILEGES FOR ROLE CURRENT_USER IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO scv_app;
ALTER DEFAULT PRIVILEGES FOR ROLE CURRENT_USER IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO scv_app;
SQL
