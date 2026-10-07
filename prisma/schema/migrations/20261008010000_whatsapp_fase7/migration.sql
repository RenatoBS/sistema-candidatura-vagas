ALTER TABLE respostas ADD COLUMN "revisaoHumanaNecessaria" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE eventos_whatsapp_entrada (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "empresaId" UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  "instanciaWhatsappId" UUID NOT NULL REFERENCES instancias_whatsapp(id) ON DELETE CASCADE,
  "mensagemIdProvedor" TEXT NOT NULL,
  tipo "TipoMensagemWhatsapp" NOT NULL,
  "payloadNormalizado" JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'RECEBIDO',
  "criadoEm" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT eventos_whatsapp_entrada_unico UNIQUE ("instanciaWhatsappId", "mensagemIdProvedor")
);
CREATE INDEX eventos_whatsapp_entrada_empresa_idx ON eventos_whatsapp_entrada ("empresaId");
ALTER TABLE eventos_whatsapp_entrada ENABLE ROW LEVEL SECURITY;
CREATE POLICY eventos_whatsapp_entrada_tenant ON eventos_whatsapp_entrada USING ("empresaId"::text = current_setting('app.empresa_id', true));
CREATE POLICY eventos_whatsapp_entrada_sistema ON eventos_whatsapp_entrada FOR ALL USING (current_setting('app.is_system', true) = 'true') WITH CHECK (current_setting('app.is_system', true) = 'true');
