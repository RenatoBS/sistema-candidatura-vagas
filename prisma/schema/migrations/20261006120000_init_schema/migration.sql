-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "OrigemHabilidadeCandidato" AS ENUM ('MANUAL', 'CV_EXTRAIDO', 'SUGESTAO_IA');

-- CreateEnum
CREATE TYPE "MetodoExtracaoCurriculo" AS ENUM ('NATIVO', 'OCR', 'MISTO');

-- CreateEnum
CREATE TYPE "StatusProcessamentoCurriculo" AS ENUM ('PENDENTE', 'PROCESSANDO', 'CONCLUIDO', 'FALHA');

-- CreateEnum
CREATE TYPE "TipoConsentimento" AS ENUM ('TERMOS', 'WHATSAPP', 'AUDIO_WHATSAPP', 'GRAVACAO_VOZ', 'AVALIACAO_IA', 'VISIBILIDADE_MATCH');

-- CreateEnum
CREATE TYPE "OrigemCandidatura" AS ENUM ('DIRETA', 'MATCH');

-- CreateEnum
CREATE TYPE "StatusCandidatura" AS ENUM ('CONVIDADA', 'INSCRITA', 'TRIAGEM_WHATSAPP', 'TRIAGEM_CONCLUIDA', 'TRIAGEM_ABANDONADA', 'SEM_RESPOSTA', 'ENTREVISTA_VOZ', 'ENTREVISTA_CONCLUIDA', 'ENTREVISTA_ABANDONADA', 'EM_REVISAO', 'APROVADA', 'REPROVADA', 'CONTRATADA', 'EM_ESPERA', 'ENCERRADA_VAGA_FECHADA', 'DESISTENCIA', 'CONVITE_EXPIRADO');

-- CreateEnum
CREATE TYPE "CanalEntrevista" AS ENUM ('WHATSAPP', 'VOZ_TEMPO_REAL');

-- CreateEnum
CREATE TYPE "StatusEntrevista" AS ENUM ('AGENDADA', 'AGUARDANDO_INICIO', 'RETRY_1', 'RETRY_2', 'RETRY_3', 'EM_ANDAMENTO', 'AGUARDANDO_RESPOSTA', 'PROCESSANDO', 'CONCLUIDA', 'ABANDONADA', 'SEM_RESPOSTA', 'RECUSADA', 'CANCELADA', 'SUSPENSA_PAUSA', 'SUSPENSA_INSTANCIA', 'DISPONIVEL', 'ACEITE_REGISTRADO', 'EM_SESSAO', 'RECONECTANDO', 'EXPIRADA');

-- CreateEnum
CREATE TYPE "TipoResposta" AS ENUM ('AUDIO_WHATSAPP', 'TEXTO_WHATSAPP', 'VOZ_TEMPO_REAL');

-- CreateEnum
CREATE TYPE "StatusTranscricao" AS ENUM ('PENDENTE', 'PROCESSANDO', 'CONCLUIDA', 'FALHA');

-- CreateEnum
CREATE TYPE "StatusInstanciaWhatsapp" AS ENUM ('AGUARDANDO_QR', 'CONECTADA', 'DESCONECTADA');

-- CreateEnum
CREATE TYPE "ProvedorWhatsapp" AS ENUM ('UAZAPI');

-- CreateEnum
CREATE TYPE "DirecaoMensagemWhatsapp" AS ENUM ('ENVIADA', 'RECEBIDA');

-- CreateEnum
CREATE TYPE "TipoMensagemWhatsapp" AS ENUM ('TEXTO', 'AUDIO', 'MENU', 'MIDIA', 'OUTRO');

-- CreateEnum
CREATE TYPE "StatusMensagemWhatsapp" AS ENUM ('PENDENTE', 'ENVIADA', 'ENTREGUE', 'LIDA', 'FALHA', 'IGNORADA');

-- CreateEnum
CREATE TYPE "AvaliadorTipo" AS ENUM ('IA', 'HUMANO');

-- CreateEnum
CREATE TYPE "StatusSessaoVoz" AS ENUM ('CONECTANDO', 'ATIVA', 'RECONECTANDO', 'FINALIZADA', 'ABANDONADA');

-- CreateEnum
CREATE TYPE "TipoNotificacao" AS ENUM ('CANDIDATO_NOVO', 'MATCH_FORTE', 'VERIFICACAO_APROVADA', 'VERIFICACAO_REJEITADA', 'INSCRICOES_ENCERRADAS', 'VAGA_PAUSADA', 'VAGA_RETOMADA', 'WHATSAPP_DESCONECTADO', 'STATUS_CANDIDATURA', 'OPERACIONAL');

-- CreateEnum
CREATE TYPE "StatusSugestaoMatch" AS ENUM ('PENDENTE', 'NOTIFICADA', 'CONVIDADA', 'ACEITA', 'RECUSADA', 'EXPIRADA');

-- CreateEnum
CREATE TYPE "PlataformaPush" AS ENUM ('IOS', 'ANDROID', 'WEB');

-- CreateEnum
CREATE TYPE "PapelGlobal" AS ENUM ('ADMIN_PLATAFORMA');

-- CreateEnum
CREATE TYPE "PapelEmpresa" AS ENUM ('ADMIN_EMPRESA', 'RECRUTADOR', 'AVALIADOR');

-- CreateEnum
CREATE TYPE "StatusMembroEmpresa" AS ENUM ('ATIVO', 'CONVIDADO', 'REMOVIDO');

-- CreateEnum
CREATE TYPE "StatusVerificacaoEmpresa" AS ENUM ('PENDENTE', 'VERIFICADA', 'REJEITADA', 'SUSPENSA');

-- CreateEnum
CREATE TYPE "TipoVerificacaoEmpresa" AS ENUM ('EMAIL', 'DOMINIO', 'CNPJ', 'REVISAO_MANUAL');

-- CreateEnum
CREATE TYPE "VisaoPreferida" AS ENUM ('CANDIDATO', 'EMPRESA', 'ADMIN');

-- CreateEnum
CREATE TYPE "StatusVaga" AS ENUM ('RASCUNHO', 'PUBLICADA', 'PAUSADA', 'INSCRICOES_ENCERRADAS', 'FECHADA');

-- CreateEnum
CREATE TYPE "SenioridadeVaga" AS ENUM ('ESTAGIO', 'JUNIOR', 'PLENO', 'SENIOR', 'ESPECIALISTA', 'LIDERANCA');

-- CreateEnum
CREATE TYPE "ModeloTrabalho" AS ENUM ('REMOTO', 'HIBRIDO', 'PRESENCIAL');

-- CreateEnum
CREATE TYPE "TipoContrato" AS ENUM ('CLT', 'PJ', 'TEMPORARIO', 'ESTAGIO', 'AUTONOMO');

-- CreateEnum
CREATE TYPE "TipoEtapa" AS ENUM ('TRIAGEM_WHATSAPP', 'ENTREVISTA_VOZ', 'REVISAO_HUMANA');

-- CreateEnum
CREATE TYPE "OrigemPergunta" AS ENUM ('EMPRESA', 'IA_SUGERIDA', 'CATALOGO');

-- CreateTable
CREATE TABLE "candidatos" (
    "id" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "whatsapp" TEXT,
    "whatsappVerificado" BOOLEAN NOT NULL DEFAULT false,
    "linkedinUrl" TEXT,
    "perfil" JSONB NOT NULL DEFAULT '{}',
    "visivelParaMatch" BOOLEAN NOT NULL DEFAULT true,
    "embedding" vector(1536),
    "criadoEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "candidatos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidatos_habilidades" (
    "candidatoId" UUID NOT NULL,
    "habilidadeId" UUID NOT NULL,
    "nivel" INTEGER NOT NULL,
    "anosExperiencia" DOUBLE PRECISION,
    "origem" "OrigemHabilidadeCandidato" NOT NULL DEFAULT 'MANUAL',
    "criadoEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "candidatos_habilidades_pkey" PRIMARY KEY ("candidatoId","habilidadeId")
);

-- CreateTable
CREATE TABLE "curriculos" (
    "id" UUID NOT NULL,
    "candidatoId" UUID NOT NULL,
    "arquivoKey" TEXT NOT NULL,
    "metodoExtracao" "MetodoExtracaoCurriculo",
    "statusProcessamento" "StatusProcessamentoCurriculo" NOT NULL DEFAULT 'PENDENTE',
    "confiancaOcr" DOUBLE PRECISION,
    "textoExtraido" TEXT,
    "dadosExtraidos" JSONB,
    "criadoEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "curriculos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consentimentos" (
    "id" UUID NOT NULL,
    "candidatoId" UUID NOT NULL,
    "candidaturaId" UUID,
    "tipo" "TipoConsentimento" NOT NULL,
    "concedido" BOOLEAN NOT NULL,
    "versaoTermo" TEXT NOT NULL,
    "criadoEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consentimentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidaturas" (
    "id" UUID NOT NULL,
    "empresaId" UUID NOT NULL,
    "vagaId" UUID NOT NULL,
    "candidatoId" UUID NOT NULL,
    "origem" "OrigemCandidatura" NOT NULL,
    "status" "StatusCandidatura" NOT NULL DEFAULT 'INSCRITA',
    "statusAntesDaEspera" "StatusCandidatura",
    "etapaAtualId" UUID,
    "criadoEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "candidaturas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entrevistas" (
    "id" UUID NOT NULL,
    "empresaId" UUID NOT NULL,
    "candidaturaId" UUID NOT NULL,
    "etapaId" UUID NOT NULL,
    "canal" "CanalEntrevista" NOT NULL,
    "status" "StatusEntrevista" NOT NULL DEFAULT 'AGENDADA',
    "retryAtual" INTEGER NOT NULL DEFAULT 0,
    "perguntaAtual" INTEGER NOT NULL DEFAULT 0,
    "iniciadaEm" TIMESTAMPTZ,
    "ultimaInteracaoEm" TIMESTAMPTZ,
    "proximoRetryEm" TIMESTAMPTZ,
    "aceiteTentativaEm" TIMESTAMPTZ,
    "excecaoConcedida" BOOLEAN NOT NULL DEFAULT false,
    "encerrarAoFim" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "entrevistas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessoes_voz" (
    "id" UUID NOT NULL,
    "entrevistaId" UUID NOT NULL,
    "salaId" TEXT NOT NULL,
    "status" "StatusSessaoVoz" NOT NULL DEFAULT 'CONECTANDO',
    "inicioEm" TIMESTAMPTZ,
    "fimEm" TIMESTAMPTZ,
    "desconectadoEm" TIMESTAMPTZ,
    "motivoFim" TEXT,
    "gravacaoKey" TEXT,
    "criadoEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "sessoes_voz_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "respostas" (
    "id" UUID NOT NULL,
    "empresaId" UUID NOT NULL,
    "entrevistaId" UUID NOT NULL,
    "etapaPerguntaId" UUID NOT NULL,
    "tipo" "TipoResposta" NOT NULL,
    "textoOriginal" TEXT,
    "audioUrl" TEXT,
    "duracaoSegundos" INTEGER,
    "statusTranscricao" "StatusTranscricao" NOT NULL DEFAULT 'PENDENTE',
    "transcricao" TEXT,
    "confiancaTranscricao" DOUBLE PRECISION,
    "tempoUsado" INTEGER,
    "expirou" BOOLEAN NOT NULL DEFAULT false,
    "parcial" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "respostas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instancias_whatsapp" (
    "id" UUID NOT NULL,
    "empresaId" UUID NOT NULL,
    "provedor" "ProvedorWhatsapp" NOT NULL DEFAULT 'UAZAPI',
    "instanciaIdProvedorCifrado" TEXT NOT NULL,
    "tokenCifrado" TEXT NOT NULL,
    "numero" TEXT,
    "status" "StatusInstanciaWhatsapp" NOT NULL DEFAULT 'AGUARDANDO_QR',
    "ultimaConexaoEm" TIMESTAMPTZ,
    "desconectadaEm" TIMESTAMPTZ,
    "criadoEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "instancias_whatsapp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mensagens_whatsapp" (
    "id" UUID NOT NULL,
    "entrevistaId" UUID NOT NULL,
    "instanciaWhatsappId" UUID,
    "mensagemIdProvedor" TEXT NOT NULL,
    "direcao" "DirecaoMensagemWhatsapp" NOT NULL,
    "tipo" "TipoMensagemWhatsapp" NOT NULL,
    "status" "StatusMensagemWhatsapp" NOT NULL DEFAULT 'PENDENTE',
    "payload" JSONB NOT NULL DEFAULT '{}',
    "criadoEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mensagens_whatsapp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "avaliacoes" (
    "id" UUID NOT NULL,
    "respostaId" UUID NOT NULL,
    "avaliador" "AvaliadorTipo" NOT NULL,
    "nota" DOUBLE PRECISION NOT NULL,
    "criterios" JSONB NOT NULL DEFAULT '{}',
    "justificativa" TEXT,
    "modelo" TEXT,
    "versaoPrompt" TEXT,
    "criadoEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "avaliacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scores" (
    "id" UUID NOT NULL,
    "candidaturaId" UUID NOT NULL,
    "scorePerfil" DOUBLE PRECISION,
    "scoreHabilidades" DOUBLE PRECISION,
    "scoreCurriculo" DOUBLE PRECISION,
    "scoreLinkedin" DOUBLE PRECISION,
    "scoreTriagem" DOUBLE PRECISION,
    "scoreEntrevista" DOUBLE PRECISION,
    "scoreFinal" DOUBLE PRECISION,
    "completude" DOUBLE PRECISION,
    "explicacao" JSONB NOT NULL DEFAULT '{}',
    "versaoAlgoritmo" INTEGER NOT NULL DEFAULT 1,
    "criadoEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historico_status" (
    "id" UUID NOT NULL,
    "candidaturaId" UUID NOT NULL,
    "de" TEXT NOT NULL,
    "para" TEXT NOT NULL,
    "autorId" UUID,
    "motivo" TEXT,
    "criadoEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historico_status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "papeisGlobais" "PapelGlobal"[],
    "mfaAtivo" BOOLEAN NOT NULL DEFAULT false,
    "mfaSecretCifrado" TEXT,
    "visaoPreferida" "VisaoPreferida" NOT NULL DEFAULT 'CANDIDATO',
    "emailConfirmadoEm" TIMESTAMPTZ,
    "criadoEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "empresas" (
    "id" UUID NOT NULL,
    "razaoSocial" TEXT NOT NULL,
    "nomeFantasia" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "dominio" TEXT NOT NULL,
    "responsavelNome" TEXT NOT NULL,
    "responsavelEmail" TEXT NOT NULL,
    "responsavelCargo" TEXT,
    "telefone" TEXT,
    "endereco" JSONB,
    "statusVerificacao" "StatusVerificacaoEmpresa" NOT NULL DEFAULT 'PENDENTE',
    "verificadaEm" TIMESTAMPTZ,
    "configuracoes" JSONB NOT NULL DEFAULT '{}',
    "criadoEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "empresas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verificacoes_empresa" (
    "id" UUID NOT NULL,
    "empresaId" UUID NOT NULL,
    "tipo" "TipoVerificacaoEmpresa" NOT NULL,
    "resultado" TEXT NOT NULL,
    "detalhes" JSONB NOT NULL DEFAULT '{}',
    "revisorAdminId" UUID,
    "motivo" TEXT,
    "criadoEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verificacoes_empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membros_empresa" (
    "id" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "empresaId" UUID NOT NULL,
    "papeis" "PapelEmpresa"[],
    "status" "StatusMembroEmpresa" NOT NULL DEFAULT 'ATIVO',
    "criadoEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "membros_empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditorias_acesso" (
    "id" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "empresaId" UUID,
    "papel" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "recursoTipo" TEXT NOT NULL,
    "recursoId" UUID,
    "motivo" TEXT,
    "criadoEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditorias_acesso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificacoes" (
    "id" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "empresaId" UUID,
    "tipo" "TipoNotificacao" NOT NULL,
    "chaveDedup" TEXT NOT NULL,
    "dados" JSONB NOT NULL DEFAULT '{}',
    "agrupadas" INTEGER NOT NULL DEFAULT 1,
    "lidaEm" TIMESTAMPTZ,
    "criadoEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "preferencias_notificacao" (
    "id" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "empresaId" UUID,
    "tipo" "TipoNotificacao" NOT NULL,
    "push" BOOLEAN NOT NULL DEFAULT true,
    "email" BOOLEAN NOT NULL DEFAULT false,
    "inApp" BOOLEAN NOT NULL DEFAULT true,
    "limiarMatch" DOUBLE PRECISION,
    "criadoEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "preferencias_notificacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispositivos_push" (
    "id" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "plataforma" "PlataformaPush" NOT NULL,
    "ultimoUsoEm" TIMESTAMPTZ,
    "criadoEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispositivos_push_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sugestoes_match" (
    "id" UUID NOT NULL,
    "vagaId" UUID NOT NULL,
    "candidatoId" UUID NOT NULL,
    "compatibilidade" DOUBLE PRECISION NOT NULL,
    "explicacao" JSONB NOT NULL DEFAULT '{}',
    "status" "StatusSugestaoMatch" NOT NULL DEFAULT 'PENDENTE',
    "notificadoEm" TIMESTAMPTZ,
    "criadoEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "sugestoes_match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "habilidades" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "sinonimos" TEXT[],
    "criadoEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "habilidades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vagas" (
    "id" UUID NOT NULL,
    "empresaId" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "senioridade" "SenioridadeVaga" NOT NULL,
    "modelo" "ModeloTrabalho" NOT NULL,
    "localidade" TEXT,
    "tipoContrato" "TipoContrato",
    "faixaSalarialMin" DOUBLE PRECISION,
    "faixaSalarialMax" DOUBLE PRECISION,
    "beneficios" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "posicoes" INTEGER NOT NULL DEFAULT 1,
    "status" "StatusVaga" NOT NULL DEFAULT 'RASCUNHO',
    "prazoInscricoes" TIMESTAMPTZ,
    "inscricoesEncerradasEm" TIMESTAMPTZ,
    "pausadaEm" TIMESTAMPTZ,
    "statusAntesDaPausa" "StatusVaga",
    "fechadaEm" TIMESTAMPTZ,
    "motivoFechamento" TEXT,
    "pesosRanking" JSONB NOT NULL DEFAULT '{}',
    "embedding" vector(1536),
    "criadoEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "vagas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vagas_habilidades" (
    "vagaId" UUID NOT NULL,
    "habilidadeId" UUID NOT NULL,
    "nivelMinimo" INTEGER NOT NULL,
    "peso" DOUBLE PRECISION NOT NULL,
    "obrigatoria" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "vagas_habilidades_pkey" PRIMARY KEY ("vagaId","habilidadeId")
);

-- CreateTable
CREATE TABLE "processos_seletivos" (
    "id" UUID NOT NULL,
    "vagaId" UUID NOT NULL,
    "empresaId" UUID NOT NULL,
    "tempoPadraoPorPergunta" INTEGER NOT NULL DEFAULT 180,
    "politicaRetry" JSONB NOT NULL DEFAULT '{}',
    "janelaReconexaoSegundos" INTEGER NOT NULL DEFAULT 60,
    "criadoEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "processos_seletivos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "etapas" (
    "id" UUID NOT NULL,
    "processoId" UUID NOT NULL,
    "ordem" INTEGER NOT NULL,
    "tipo" "TipoEtapa" NOT NULL,
    "numeroPerguntas" INTEGER NOT NULL DEFAULT 5,
    "criadoEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "etapas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "perguntas" (
    "id" UUID NOT NULL,
    "empresaId" UUID NOT NULL,
    "enunciado" TEXT NOT NULL,
    "rubrica" JSONB NOT NULL DEFAULT '{}',
    "origem" "OrigemPergunta" NOT NULL DEFAULT 'EMPRESA',
    "tempoLimiteSegundos" INTEGER,
    "criadoEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "perguntas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "etapas_perguntas" (
    "id" UUID NOT NULL,
    "etapaId" UUID NOT NULL,
    "perguntaId" UUID NOT NULL,
    "ordem" INTEGER NOT NULL,
    "peso" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "tempoLimiteSegundos" INTEGER,
    "criadoEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "etapas_perguntas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "candidatos_usuarioId_key" ON "candidatos"("usuarioId");

-- CreateIndex
CREATE INDEX "curriculos_candidatoId_idx" ON "curriculos"("candidatoId");

-- CreateIndex
CREATE INDEX "consentimentos_candidatoId_idx" ON "consentimentos"("candidatoId");

-- CreateIndex
CREATE INDEX "candidaturas_empresaId_status_idx" ON "candidaturas"("empresaId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "candidaturas_vagaId_candidatoId_key" ON "candidaturas"("vagaId", "candidatoId");

-- CreateIndex
CREATE INDEX "entrevistas_empresaId_status_idx" ON "entrevistas"("empresaId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "entrevistas_candidaturaId_etapaId_key" ON "entrevistas"("candidaturaId", "etapaId");

-- CreateIndex
CREATE INDEX "sessoes_voz_entrevistaId_idx" ON "sessoes_voz"("entrevistaId");

-- CreateIndex
CREATE INDEX "respostas_empresaId_idx" ON "respostas"("empresaId");

-- CreateIndex
CREATE INDEX "respostas_entrevistaId_idx" ON "respostas"("entrevistaId");

-- CreateIndex
CREATE UNIQUE INDEX "instancias_whatsapp_empresaId_key" ON "instancias_whatsapp"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "mensagens_whatsapp_mensagemIdProvedor_key" ON "mensagens_whatsapp"("mensagemIdProvedor");

-- CreateIndex
CREATE INDEX "mensagens_whatsapp_entrevistaId_idx" ON "mensagens_whatsapp"("entrevistaId");

-- CreateIndex
CREATE INDEX "avaliacoes_respostaId_idx" ON "avaliacoes"("respostaId");

-- CreateIndex
CREATE INDEX "scores_candidaturaId_idx" ON "scores"("candidaturaId");

-- CreateIndex
CREATE INDEX "historico_status_candidaturaId_criadoEm_idx" ON "historico_status"("candidaturaId", "criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "empresas_cnpj_key" ON "empresas"("cnpj");

-- CreateIndex
CREATE INDEX "empresas_statusVerificacao_idx" ON "empresas"("statusVerificacao");

-- CreateIndex
CREATE INDEX "verificacoes_empresa_empresaId_idx" ON "verificacoes_empresa"("empresaId");

-- CreateIndex
CREATE INDEX "membros_empresa_empresaId_idx" ON "membros_empresa"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "membros_empresa_usuarioId_empresaId_key" ON "membros_empresa"("usuarioId", "empresaId");

-- CreateIndex
CREATE INDEX "auditorias_acesso_empresaId_criadoEm_idx" ON "auditorias_acesso"("empresaId", "criadoEm");

-- CreateIndex
CREATE INDEX "auditorias_acesso_usuarioId_criadoEm_idx" ON "auditorias_acesso"("usuarioId", "criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "notificacoes_chaveDedup_key" ON "notificacoes"("chaveDedup");

-- CreateIndex
CREATE INDEX "notificacoes_usuarioId_criadoEm_idx" ON "notificacoes"("usuarioId", "criadoEm");

-- CreateIndex
CREATE INDEX "notificacoes_empresaId_idx" ON "notificacoes"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "preferencias_notificacao_usuarioId_empresaId_tipo_key" ON "preferencias_notificacao"("usuarioId", "empresaId", "tipo");

-- CreateIndex
CREATE UNIQUE INDEX "dispositivos_push_token_key" ON "dispositivos_push"("token");

-- CreateIndex
CREATE INDEX "dispositivos_push_usuarioId_idx" ON "dispositivos_push"("usuarioId");

-- CreateIndex
CREATE INDEX "sugestoes_match_vagaId_status_idx" ON "sugestoes_match"("vagaId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "sugestoes_match_vagaId_candidatoId_key" ON "sugestoes_match"("vagaId", "candidatoId");

-- CreateIndex
CREATE UNIQUE INDEX "habilidades_nome_key" ON "habilidades"("nome");

-- CreateIndex
CREATE INDEX "vagas_empresaId_status_idx" ON "vagas"("empresaId", "status");

-- CreateIndex
CREATE INDEX "vagas_status_prazoInscricoes_idx" ON "vagas"("status", "prazoInscricoes");

-- CreateIndex
CREATE UNIQUE INDEX "processos_seletivos_vagaId_key" ON "processos_seletivos"("vagaId");

-- CreateIndex
CREATE INDEX "processos_seletivos_empresaId_idx" ON "processos_seletivos"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "etapas_processoId_ordem_key" ON "etapas"("processoId", "ordem");

-- CreateIndex
CREATE INDEX "perguntas_empresaId_idx" ON "perguntas"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "etapas_perguntas_etapaId_ordem_key" ON "etapas_perguntas"("etapaId", "ordem");

-- CreateIndex
CREATE UNIQUE INDEX "etapas_perguntas_etapaId_perguntaId_key" ON "etapas_perguntas"("etapaId", "perguntaId");

-- AddForeignKey
ALTER TABLE "candidatos" ADD CONSTRAINT "candidatos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidatos_habilidades" ADD CONSTRAINT "candidatos_habilidades_candidatoId_fkey" FOREIGN KEY ("candidatoId") REFERENCES "candidatos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidatos_habilidades" ADD CONSTRAINT "candidatos_habilidades_habilidadeId_fkey" FOREIGN KEY ("habilidadeId") REFERENCES "habilidades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculos" ADD CONSTRAINT "curriculos_candidatoId_fkey" FOREIGN KEY ("candidatoId") REFERENCES "candidatos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consentimentos" ADD CONSTRAINT "consentimentos_candidatoId_fkey" FOREIGN KEY ("candidatoId") REFERENCES "candidatos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consentimentos" ADD CONSTRAINT "consentimentos_candidaturaId_fkey" FOREIGN KEY ("candidaturaId") REFERENCES "candidaturas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidaturas" ADD CONSTRAINT "candidaturas_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidaturas" ADD CONSTRAINT "candidaturas_vagaId_fkey" FOREIGN KEY ("vagaId") REFERENCES "vagas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidaturas" ADD CONSTRAINT "candidaturas_candidatoId_fkey" FOREIGN KEY ("candidatoId") REFERENCES "candidatos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidaturas" ADD CONSTRAINT "candidaturas_etapaAtualId_fkey" FOREIGN KEY ("etapaAtualId") REFERENCES "etapas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entrevistas" ADD CONSTRAINT "entrevistas_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entrevistas" ADD CONSTRAINT "entrevistas_candidaturaId_fkey" FOREIGN KEY ("candidaturaId") REFERENCES "candidaturas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entrevistas" ADD CONSTRAINT "entrevistas_etapaId_fkey" FOREIGN KEY ("etapaId") REFERENCES "etapas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessoes_voz" ADD CONSTRAINT "sessoes_voz_entrevistaId_fkey" FOREIGN KEY ("entrevistaId") REFERENCES "entrevistas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respostas" ADD CONSTRAINT "respostas_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respostas" ADD CONSTRAINT "respostas_entrevistaId_fkey" FOREIGN KEY ("entrevistaId") REFERENCES "entrevistas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respostas" ADD CONSTRAINT "respostas_etapaPerguntaId_fkey" FOREIGN KEY ("etapaPerguntaId") REFERENCES "etapas_perguntas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instancias_whatsapp" ADD CONSTRAINT "instancias_whatsapp_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagens_whatsapp" ADD CONSTRAINT "mensagens_whatsapp_entrevistaId_fkey" FOREIGN KEY ("entrevistaId") REFERENCES "entrevistas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagens_whatsapp" ADD CONSTRAINT "mensagens_whatsapp_instanciaWhatsappId_fkey" FOREIGN KEY ("instanciaWhatsappId") REFERENCES "instancias_whatsapp"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaliacoes" ADD CONSTRAINT "avaliacoes_respostaId_fkey" FOREIGN KEY ("respostaId") REFERENCES "respostas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scores" ADD CONSTRAINT "scores_candidaturaId_fkey" FOREIGN KEY ("candidaturaId") REFERENCES "candidaturas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_status" ADD CONSTRAINT "historico_status_candidaturaId_fkey" FOREIGN KEY ("candidaturaId") REFERENCES "candidaturas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_status" ADD CONSTRAINT "historico_status_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verificacoes_empresa" ADD CONSTRAINT "verificacoes_empresa_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verificacoes_empresa" ADD CONSTRAINT "verificacoes_empresa_revisorAdminId_fkey" FOREIGN KEY ("revisorAdminId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membros_empresa" ADD CONSTRAINT "membros_empresa_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membros_empresa" ADD CONSTRAINT "membros_empresa_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditorias_acesso" ADD CONSTRAINT "auditorias_acesso_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditorias_acesso" ADD CONSTRAINT "auditorias_acesso_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preferencias_notificacao" ADD CONSTRAINT "preferencias_notificacao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preferencias_notificacao" ADD CONSTRAINT "preferencias_notificacao_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispositivos_push" ADD CONSTRAINT "dispositivos_push_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sugestoes_match" ADD CONSTRAINT "sugestoes_match_vagaId_fkey" FOREIGN KEY ("vagaId") REFERENCES "vagas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sugestoes_match" ADD CONSTRAINT "sugestoes_match_candidatoId_fkey" FOREIGN KEY ("candidatoId") REFERENCES "candidatos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vagas" ADD CONSTRAINT "vagas_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vagas_habilidades" ADD CONSTRAINT "vagas_habilidades_vagaId_fkey" FOREIGN KEY ("vagaId") REFERENCES "vagas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vagas_habilidades" ADD CONSTRAINT "vagas_habilidades_habilidadeId_fkey" FOREIGN KEY ("habilidadeId") REFERENCES "habilidades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processos_seletivos" ADD CONSTRAINT "processos_seletivos_vagaId_fkey" FOREIGN KEY ("vagaId") REFERENCES "vagas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processos_seletivos" ADD CONSTRAINT "processos_seletivos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "etapas" ADD CONSTRAINT "etapas_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "processos_seletivos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "perguntas" ADD CONSTRAINT "perguntas_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "etapas_perguntas" ADD CONSTRAINT "etapas_perguntas_etapaId_fkey" FOREIGN KEY ("etapaId") REFERENCES "etapas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "etapas_perguntas" ADD CONSTRAINT "etapas_perguntas_perguntaId_fkey" FOREIGN KEY ("perguntaId") REFERENCES "perguntas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

