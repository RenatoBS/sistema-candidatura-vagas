-- FC-16: exclusão LGPD em duas etapas (expurgo no banco + job que apaga arquivos), com relatório.
ALTER TABLE "solicitacoes_lgpd" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'CONCLUIDA';
ALTER TABLE "solicitacoes_lgpd" ADD COLUMN "arquivosPendentes" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "solicitacoes_lgpd" ADD COLUMN "relatorio" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "solicitacoes_lgpd" ADD COLUMN "concluidaEm" TIMESTAMPTZ;
