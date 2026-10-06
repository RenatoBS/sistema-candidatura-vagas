-- Fase 5: metadados de currículo (upload, antivírus, confirmação) e trilha LGPD.
-- Tabelas globais do titular (sem empresaId): não habilitam RLS.

CREATE TYPE "StatusAntivirus" AS ENUM ('PENDENTE', 'LIMPO', 'INFECTADO');

CREATE TYPE "TipoSolicitacaoLgpd" AS ENUM ('EXPORTACAO', 'EXCLUSAO');

ALTER TABLE "curriculos" ADD COLUMN "mimeType" TEXT;
ALTER TABLE "curriculos" ADD COLUMN "tamanhoBytes" INTEGER;
ALTER TABLE "curriculos" ADD COLUMN "antivirusStatus" "StatusAntivirus" NOT NULL DEFAULT 'PENDENTE';
ALTER TABLE "curriculos" ADD COLUMN "confirmadoEm" TIMESTAMPTZ;
ALTER TABLE "curriculos" ADD COLUMN "aplicadoAoPerfil" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "curriculos" ADD COLUMN "paginas" JSONB;

CREATE UNIQUE INDEX "curriculos_arquivoKey_key" ON "curriculos"("arquivoKey");

CREATE TABLE "solicitacoes_lgpd" (
    "id" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "candidatoId" UUID,
    "tipo" "TipoSolicitacaoLgpd" NOT NULL,
    "criadoEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "solicitacoes_lgpd_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "solicitacoes_lgpd_usuarioId_idx" ON "solicitacoes_lgpd"("usuarioId");

ALTER TABLE "solicitacoes_lgpd" ADD CONSTRAINT "solicitacoes_lgpd_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "solicitacoes_lgpd" ADD CONSTRAINT "solicitacoes_lgpd_candidatoId_fkey" FOREIGN KEY ("candidatoId") REFERENCES "candidatos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
