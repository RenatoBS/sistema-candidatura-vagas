ALTER TABLE "candidatos" ADD COLUMN "whatsappVerificadoEm" TIMESTAMPTZ;
ALTER TABLE "entrevistas" ADD COLUMN "contexto" JSONB NOT NULL DEFAULT '{}';

CREATE TABLE "quedas_instancia_whatsapp" (
  "id" UUID NOT NULL,
  "empresaId" UUID NOT NULL,
  "instanciaWhatsappId" UUID NOT NULL,
  "inicioEm" TIMESTAMPTZ NOT NULL,
  "fimEm" TIMESTAMPTZ,
  "notificadaEm" TIMESTAMPTZ,
  "criadoEm" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "quedas_instancia_whatsapp_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "quedas_instancia_whatsapp_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "quedas_instancia_whatsapp_instanciaWhatsappId_fkey" FOREIGN KEY ("instanciaWhatsappId") REFERENCES "instancias_whatsapp"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "quedas_instancia_whatsapp_empresaId_idx" ON "quedas_instancia_whatsapp" ("empresaId");
CREATE INDEX "quedas_instancia_whatsapp_instanciaWhatsappId_idx" ON "quedas_instancia_whatsapp" ("instanciaWhatsappId");
ALTER TABLE "quedas_instancia_whatsapp" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quedas_instancia_whatsapp" FORCE ROW LEVEL SECURITY;
CREATE POLICY quedas_instancia_whatsapp_tenant ON "quedas_instancia_whatsapp" FOR ALL USING (app_is_admin() OR "empresaId" = app_current_empresa_id()) WITH CHECK (app_is_admin() OR "empresaId" = app_current_empresa_id());
CREATE POLICY quedas_instancia_whatsapp_sistema ON "quedas_instancia_whatsapp" FOR ALL USING (current_setting('app.is_system', true) = 'true') WITH CHECK (current_setting('app.is_system', true) = 'true');

-- Jobs internos da triagem (webhook, STT, retry, avaliação) rodam sem usuário.
CREATE POLICY entrevistas_sistema ON entrevistas
  FOR ALL USING (current_setting('app.is_system', true) = 'true')
  WITH CHECK (current_setting('app.is_system', true) = 'true');
CREATE POLICY respostas_sistema ON respostas
  FOR ALL USING (current_setting('app.is_system', true) = 'true')
  WITH CHECK (current_setting('app.is_system', true) = 'true');
CREATE POLICY avaliacoes_sistema ON avaliacoes
  FOR ALL USING (current_setting('app.is_system', true) = 'true')
  WITH CHECK (current_setting('app.is_system', true) = 'true');
CREATE POLICY instancias_whatsapp_sistema ON instancias_whatsapp
  FOR ALL USING (current_setting('app.is_system', true) = 'true')
  WITH CHECK (current_setting('app.is_system', true) = 'true');
CREATE POLICY sessoes_voz_sistema ON sessoes_voz
  FOR ALL USING (current_setting('app.is_system', true) = 'true')
  WITH CHECK (current_setting('app.is_system', true) = 'true');
