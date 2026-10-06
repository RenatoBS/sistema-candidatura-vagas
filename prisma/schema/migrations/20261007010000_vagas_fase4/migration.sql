-- Fase 4 — sugestões de pergunta, alerta de pausa e eventos de vaga.

CREATE TYPE "StatusSugestao" AS ENUM ('NAO_APLICA', 'PENDENTE', 'APROVADA', 'DESCARTADA');

ALTER TABLE "vagas" ADD COLUMN "alertaPausaEm" TIMESTAMPTZ;

ALTER TABLE "perguntas"
  ADD COLUMN "statusSugestao" "StatusSugestao" NOT NULL DEFAULT 'NAO_APLICA',
  ADD COLUMN "versaoPrompt" TEXT,
  ADD COLUMN "etapaAlvoId" UUID;

ALTER TABLE "perguntas"
  ADD CONSTRAINT "perguntas_etapaAlvoId_fkey"
  FOREIGN KEY ("etapaAlvoId") REFERENCES "etapas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "eventos_vaga" (
  "id" UUID NOT NULL,
  "empresaId" UUID NOT NULL,
  "vagaId" UUID NOT NULL,
  "tipo" TEXT NOT NULL,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "criadoEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "consumidoEm" TIMESTAMPTZ,
  CONSTRAINT "eventos_vaga_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "eventos_vaga_empresaId_consumidoEm_idx" ON "eventos_vaga"("empresaId", "consumidoEm");

ALTER TABLE "eventos_vaga"
  ADD CONSTRAINT "eventos_vaga_empresaId_fkey"
  FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "eventos_vaga"
  ADD CONSTRAINT "eventos_vaga_vagaId_fkey"
  FOREIGN KEY ("vagaId") REFERENCES "vagas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "eventos_vaga" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "eventos_vaga" FORCE ROW LEVEL SECURITY;
CREATE POLICY eventos_vaga_tenant ON eventos_vaga
  FOR ALL
  USING (app_is_admin() OR "empresaId" = app_current_empresa_id())
  WITH CHECK (app_is_admin() OR "empresaId" = app_current_empresa_id());

CREATE POLICY eventos_vaga_sistema ON eventos_vaga
  FOR ALL
  USING (current_setting('app.is_system', true) = 'true')
  WITH CHECK (current_setting('app.is_system', true) = 'true');

CREATE POLICY vagas_sistema ON vagas
  FOR ALL
  USING (current_setting('app.is_system', true) = 'true')
  WITH CHECK (current_setting('app.is_system', true) = 'true');

CREATE POLICY vagas_leitura_publica ON vagas
  FOR SELECT
  USING (
    current_setting('app.leitura_publica', true) = 'true'
    AND status = 'PUBLICADA'
    AND "prazoInscricoes" IS NOT NULL
    AND "prazoInscricoes" > now()
  );

CREATE POLICY vagas_habilidades_leitura_publica ON vagas_habilidades
  FOR SELECT
  USING (
    current_setting('app.leitura_publica', true) = 'true'
    AND EXISTS (
      SELECT 1 FROM vagas v
      WHERE v.id = vagas_habilidades."vagaId"
        AND v.status = 'PUBLICADA'
        AND v."prazoInscricoes" IS NOT NULL
        AND v."prazoInscricoes" > now()
    )
  );
