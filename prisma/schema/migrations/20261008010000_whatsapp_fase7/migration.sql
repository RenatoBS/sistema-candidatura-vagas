CREATE TYPE "StatusEventoWhatsapp" AS ENUM ('RECEBIDO', 'PROCESSADO', 'IGNORADO');
ALTER TABLE respostas ADD COLUMN "revisaoHumanaNecessaria" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE respostas ADD COLUMN "mensagemIdProvedor" TEXT;

CREATE TABLE "eventos_whatsapp_entrada" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "empresaId" UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  "instanciaWhatsappId" UUID NOT NULL REFERENCES instancias_whatsapp(id) ON DELETE CASCADE,
  "mensagemIdProvedor" TEXT NOT NULL,
  "tipo" "TipoMensagemWhatsapp" NOT NULL,
  "payloadNormalizado" JSONB NOT NULL,
  "status" "StatusEventoWhatsapp" NOT NULL DEFAULT 'RECEBIDO',
  "criadoEm" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "eventos_whatsapp_entrada_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "eventos_whatsapp_entrada_instanciaWhatsappId_mensagemIdProvedor_key" UNIQUE ("instanciaWhatsappId", "mensagemIdProvedor"),
  CONSTRAINT "eventos_whatsapp_entrada_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "eventos_whatsapp_entrada_instanciaWhatsappId_fkey" FOREIGN KEY ("instanciaWhatsappId") REFERENCES "instancias_whatsapp"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "eventos_whatsapp_entrada_empresaId_idx" ON "eventos_whatsapp_entrada" ("empresaId");
ALTER TABLE "eventos_whatsapp_entrada" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "eventos_whatsapp_entrada" FORCE ROW LEVEL SECURITY;
CREATE POLICY eventos_whatsapp_entrada_tenant ON "eventos_whatsapp_entrada" FOR ALL USING (app_is_admin() OR "empresaId" = app_current_empresa_id()) WITH CHECK (app_is_admin() OR "empresaId" = app_current_empresa_id());
CREATE POLICY eventos_whatsapp_entrada_sistema ON "eventos_whatsapp_entrada" FOR ALL USING (current_setting('app.is_system', true) = 'true') WITH CHECK (current_setting('app.is_system', true) = 'true');
