-- Fase 3 — tokens de auth, códigos MFA, convites de membro, auditoria append-only

CREATE TYPE "TipoTokenUsoUnico" AS ENUM ('CONFIRMACAO_EMAIL', 'RECUPERACAO_SENHA', 'VERIFICACAO_EMAIL_EMPRESA');

CREATE TYPE "StatusConviteMembro" AS ENUM ('PENDENTE', 'ACEITO', 'REVOGADO', 'EXPIRADO');

CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "familiaId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "mfaVerificado" BOOLEAN NOT NULL DEFAULT false,
    "expiraEm" TIMESTAMPTZ NOT NULL,
    "revogadoEm" TIMESTAMPTZ,
    "substituidoEm" TIMESTAMPTZ,
    "criadoEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tokens_uso_unico" (
    "id" UUID NOT NULL,
    "usuarioId" UUID,
    "empresaId" UUID,
    "email" TEXT NOT NULL,
    "tipo" "TipoTokenUsoUnico" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiraEm" TIMESTAMPTZ NOT NULL,
    "usadoEm" TIMESTAMPTZ,
    "criadoEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tokens_uso_unico_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "codigos_recuperacao_mfa" (
    "id" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "codigoHash" TEXT NOT NULL,
    "usadoEm" TIMESTAMPTZ,
    "criadoEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "codigos_recuperacao_mfa_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "convites_membro" (
    "id" UUID NOT NULL,
    "empresaId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "papeis" "PapelEmpresa"[],
    "tokenHash" TEXT NOT NULL,
    "convidadoPorId" UUID NOT NULL,
    "status" "StatusConviteMembro" NOT NULL DEFAULT 'PENDENTE',
    "expiraEm" TIMESTAMPTZ NOT NULL,
    "aceitoEm" TIMESTAMPTZ,
    "criadoEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "convites_membro_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");
CREATE INDEX "refresh_tokens_usuarioId_idx" ON "refresh_tokens"("usuarioId");
CREATE INDEX "refresh_tokens_familiaId_idx" ON "refresh_tokens"("familiaId");

CREATE UNIQUE INDEX "tokens_uso_unico_tokenHash_key" ON "tokens_uso_unico"("tokenHash");
CREATE INDEX "tokens_uso_unico_email_tipo_idx" ON "tokens_uso_unico"("email", "tipo");
CREATE INDEX "tokens_uso_unico_empresaId_idx" ON "tokens_uso_unico"("empresaId");

CREATE INDEX "codigos_recuperacao_mfa_usuarioId_idx" ON "codigos_recuperacao_mfa"("usuarioId");

CREATE UNIQUE INDEX "convites_membro_tokenHash_key" ON "convites_membro"("tokenHash");
CREATE INDEX "convites_membro_empresaId_idx" ON "convites_membro"("empresaId");
CREATE INDEX "convites_membro_email_idx" ON "convites_membro"("email");

ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tokens_uso_unico" ADD CONSTRAINT "tokens_uso_unico_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tokens_uso_unico" ADD CONSTRAINT "tokens_uso_unico_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "codigos_recuperacao_mfa" ADD CONSTRAINT "codigos_recuperacao_mfa_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "convites_membro" ADD CONSTRAINT "convites_membro_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "convites_membro" ADD CONSTRAINT "convites_membro_convidadoPorId_fkey" FOREIGN KEY ("convidadoPorId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Tokens de conta (empresaId nulo) e tokens da empresa. Refresh e códigos MFA
-- seguem o mesmo critério de `usuarios`: dados globais de identidade, sem RLS.
ALTER TABLE tokens_uso_unico ENABLE ROW LEVEL SECURITY;
ALTER TABLE tokens_uso_unico FORCE ROW LEVEL SECURITY;
CREATE POLICY tokens_uso_unico_tenant ON tokens_uso_unico
  FOR ALL
  USING (
    app_is_admin()
    OR "empresaId" IS NULL
    OR "empresaId" = app_current_empresa_id()
  )
  WITH CHECK (
    app_is_admin()
    OR "empresaId" IS NULL
    OR "empresaId" = app_current_empresa_id()
  );

ALTER TABLE convites_membro ENABLE ROW LEVEL SECURITY;
ALTER TABLE convites_membro FORCE ROW LEVEL SECURITY;
CREATE POLICY convites_membro_tenant ON convites_membro
  FOR ALL
  USING (app_is_admin() OR "empresaId" = app_current_empresa_id())
  WITH CHECK (app_is_admin() OR "empresaId" = app_current_empresa_id());

-- Aceite de convite ocorre antes de conhecer a empresa. A função roda como
-- o dono da migração (superusuário no provisionamento local) e devolve só a linha do hash.
CREATE OR REPLACE FUNCTION app_buscar_convite_por_token_hash(p_hash text)
RETURNS SETOF convites_membro
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM convites_membro WHERE "tokenHash" = p_hash LIMIT 1;
$$;

-- Vínculos do usuário atravessam empresas; a RLS de uma empresa só não basta para o GET /me.
CREATE OR REPLACE FUNCTION app_vinculos_do_usuario(p_usuario uuid)
RETURNS TABLE (
  "membroId" uuid,
  "empresaId" uuid,
  papeis "PapelEmpresa"[],
  status "StatusMembroEmpresa",
  "nomeFantasia" text,
  "razaoSocial" text,
  "statusVerificacao" "StatusVerificacaoEmpresa"
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.id, m."empresaId", m.papeis, m.status, e."nomeFantasia", e."razaoSocial", e."statusVerificacao"
  FROM membros_empresa m
  JOIN empresas e ON e.id = m."empresaId"
  WHERE m."usuarioId" = p_usuario
    AND m.status <> 'REMOVIDO';
$$;

CREATE OR REPLACE FUNCTION app_cnpj_existe(p_cnpj text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM empresas WHERE cnpj = p_cnpj);
$$;

GRANT EXECUTE ON FUNCTION app_buscar_convite_por_token_hash(text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION app_vinculos_do_usuario(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION app_cnpj_existe(text) TO PUBLIC;

-- Auditoria é append-only: atualização e exclusão são rejeitadas no banco.
CREATE OR REPLACE FUNCTION auditoria_append_only() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'auditorias_acesso é append-only';
END;
$$;

CREATE TRIGGER auditorias_acesso_append_only
  BEFORE UPDATE OR DELETE ON auditorias_acesso
  FOR EACH ROW
  EXECUTE FUNCTION auditoria_append_only();
