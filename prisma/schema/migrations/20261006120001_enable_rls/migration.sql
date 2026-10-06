-- Fase 2 — Row-Level Security multi-tenant (ADR 0002)

-- Funções auxiliares de contexto de sessão
CREATE OR REPLACE FUNCTION app_current_empresa_id() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.empresa_id', true), '')::uuid;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION app_is_admin() RETURNS boolean AS $$
  SELECT COALESCE(current_setting('app.is_admin', true), 'false') = 'true';
$$ LANGUAGE sql STABLE;

-- Nota: o papel scv_app (runtime) é criado pelo provisionamento/IaC com CREATEROLE.
-- Migrações rodam sem CREATEROLE; RLS usa FORCE para aplicar ao owner nos testes.

-- Habilita RLS + FORCE (inclusive para owner, necessário nos testes)
-- Tabelas com empresaId direto
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE empresas FORCE ROW LEVEL SECURITY;
CREATE POLICY empresas_tenant ON empresas
  FOR ALL
  USING (app_is_admin() OR id = app_current_empresa_id())
  WITH CHECK (app_is_admin() OR id = app_current_empresa_id());

ALTER TABLE verificacoes_empresa ENABLE ROW LEVEL SECURITY;
ALTER TABLE verificacoes_empresa FORCE ROW LEVEL SECURITY;
CREATE POLICY verificacoes_empresa_tenant ON verificacoes_empresa
  FOR ALL
  USING (app_is_admin() OR "empresaId" = app_current_empresa_id())
  WITH CHECK (app_is_admin() OR "empresaId" = app_current_empresa_id());

ALTER TABLE membros_empresa ENABLE ROW LEVEL SECURITY;
ALTER TABLE membros_empresa FORCE ROW LEVEL SECURITY;
CREATE POLICY membros_empresa_tenant ON membros_empresa
  FOR ALL
  USING (app_is_admin() OR "empresaId" = app_current_empresa_id())
  WITH CHECK (app_is_admin() OR "empresaId" = app_current_empresa_id());

ALTER TABLE vagas ENABLE ROW LEVEL SECURITY;
ALTER TABLE vagas FORCE ROW LEVEL SECURITY;
CREATE POLICY vagas_tenant ON vagas
  FOR ALL
  USING (app_is_admin() OR "empresaId" = app_current_empresa_id())
  WITH CHECK (app_is_admin() OR "empresaId" = app_current_empresa_id());

ALTER TABLE processos_seletivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE processos_seletivos FORCE ROW LEVEL SECURITY;
CREATE POLICY processos_seletivos_tenant ON processos_seletivos
  FOR ALL
  USING (app_is_admin() OR "empresaId" = app_current_empresa_id())
  WITH CHECK (app_is_admin() OR "empresaId" = app_current_empresa_id());

ALTER TABLE perguntas ENABLE ROW LEVEL SECURITY;
ALTER TABLE perguntas FORCE ROW LEVEL SECURITY;
CREATE POLICY perguntas_tenant ON perguntas
  FOR ALL
  USING (app_is_admin() OR "empresaId" = app_current_empresa_id())
  WITH CHECK (app_is_admin() OR "empresaId" = app_current_empresa_id());

ALTER TABLE candidaturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidaturas FORCE ROW LEVEL SECURITY;
CREATE POLICY candidaturas_tenant ON candidaturas
  FOR ALL
  USING (app_is_admin() OR "empresaId" = app_current_empresa_id())
  WITH CHECK (app_is_admin() OR "empresaId" = app_current_empresa_id());

ALTER TABLE entrevistas ENABLE ROW LEVEL SECURITY;
ALTER TABLE entrevistas FORCE ROW LEVEL SECURITY;
CREATE POLICY entrevistas_tenant ON entrevistas
  FOR ALL
  USING (app_is_admin() OR "empresaId" = app_current_empresa_id())
  WITH CHECK (app_is_admin() OR "empresaId" = app_current_empresa_id());

ALTER TABLE respostas ENABLE ROW LEVEL SECURITY;
ALTER TABLE respostas FORCE ROW LEVEL SECURITY;
CREATE POLICY respostas_tenant ON respostas
  FOR ALL
  USING (app_is_admin() OR "empresaId" = app_current_empresa_id())
  WITH CHECK (app_is_admin() OR "empresaId" = app_current_empresa_id());

ALTER TABLE instancias_whatsapp ENABLE ROW LEVEL SECURITY;
ALTER TABLE instancias_whatsapp FORCE ROW LEVEL SECURITY;
CREATE POLICY instancias_whatsapp_tenant ON instancias_whatsapp
  FOR ALL
  USING (app_is_admin() OR "empresaId" = app_current_empresa_id())
  WITH CHECK (app_is_admin() OR "empresaId" = app_current_empresa_id());

ALTER TABLE notificacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificacoes FORCE ROW LEVEL SECURITY;
CREATE POLICY notificacoes_tenant ON notificacoes
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

ALTER TABLE preferencias_notificacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE preferencias_notificacao FORCE ROW LEVEL SECURITY;
CREATE POLICY preferencias_notificacao_tenant ON preferencias_notificacao
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

ALTER TABLE auditorias_acesso ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditorias_acesso FORCE ROW LEVEL SECURITY;
CREATE POLICY auditorias_acesso_tenant ON auditorias_acesso
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

-- Tabelas filhas (RLS por subconsulta ao ancestral com empresaId)
ALTER TABLE etapas ENABLE ROW LEVEL SECURITY;
ALTER TABLE etapas FORCE ROW LEVEL SECURITY;
CREATE POLICY etapas_tenant ON etapas
  FOR ALL
  USING (
    app_is_admin()
    OR EXISTS (
      SELECT 1 FROM processos_seletivos ps
      WHERE ps.id = etapas."processoId"
        AND ps."empresaId" = app_current_empresa_id()
    )
  );

ALTER TABLE etapas_perguntas ENABLE ROW LEVEL SECURITY;
ALTER TABLE etapas_perguntas FORCE ROW LEVEL SECURITY;
CREATE POLICY etapas_perguntas_tenant ON etapas_perguntas
  FOR ALL
  USING (
    app_is_admin()
    OR EXISTS (
      SELECT 1 FROM etapas e
      JOIN processos_seletivos ps ON ps.id = e."processoId"
      WHERE e.id = etapas_perguntas."etapaId"
        AND ps."empresaId" = app_current_empresa_id()
    )
  );

ALTER TABLE vagas_habilidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE vagas_habilidades FORCE ROW LEVEL SECURITY;
CREATE POLICY vagas_habilidades_tenant ON vagas_habilidades
  FOR ALL
  USING (
    app_is_admin()
    OR EXISTS (
      SELECT 1 FROM vagas v
      WHERE v.id = vagas_habilidades."vagaId"
        AND v."empresaId" = app_current_empresa_id()
    )
  );

ALTER TABLE sessoes_voz ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessoes_voz FORCE ROW LEVEL SECURITY;
CREATE POLICY sessoes_voz_tenant ON sessoes_voz
  FOR ALL
  USING (
    app_is_admin()
    OR EXISTS (
      SELECT 1 FROM entrevistas en
      WHERE en.id = sessoes_voz."entrevistaId"
        AND en."empresaId" = app_current_empresa_id()
    )
  );

ALTER TABLE mensagens_whatsapp ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensagens_whatsapp FORCE ROW LEVEL SECURITY;
CREATE POLICY mensagens_whatsapp_tenant ON mensagens_whatsapp
  FOR ALL
  USING (
    app_is_admin()
    OR EXISTS (
      SELECT 1 FROM entrevistas en
      WHERE en.id = mensagens_whatsapp."entrevistaId"
        AND en."empresaId" = app_current_empresa_id()
    )
  );

ALTER TABLE avaliacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE avaliacoes FORCE ROW LEVEL SECURITY;
CREATE POLICY avaliacoes_tenant ON avaliacoes
  FOR ALL
  USING (
    app_is_admin()
    OR EXISTS (
      SELECT 1 FROM respostas r
      WHERE r.id = avaliacoes."respostaId"
        AND r."empresaId" = app_current_empresa_id()
    )
  );

ALTER TABLE scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores FORCE ROW LEVEL SECURITY;
CREATE POLICY scores_tenant ON scores
  FOR ALL
  USING (
    app_is_admin()
    OR EXISTS (
      SELECT 1 FROM candidaturas c
      WHERE c.id = scores."candidaturaId"
        AND c."empresaId" = app_current_empresa_id()
    )
  );

ALTER TABLE historico_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE historico_status FORCE ROW LEVEL SECURITY;
CREATE POLICY historico_status_tenant ON historico_status
  FOR ALL
  USING (
    app_is_admin()
    OR EXISTS (
      SELECT 1 FROM candidaturas c
      WHERE c.id = historico_status."candidaturaId"
        AND c."empresaId" = app_current_empresa_id()
    )
  );

ALTER TABLE sugestoes_match ENABLE ROW LEVEL SECURITY;
ALTER TABLE sugestoes_match FORCE ROW LEVEL SECURITY;
CREATE POLICY sugestoes_match_tenant ON sugestoes_match
  FOR ALL
  USING (
    app_is_admin()
    OR EXISTS (
      SELECT 1 FROM vagas v
      WHERE v.id = sugestoes_match."vagaId"
        AND v."empresaId" = app_current_empresa_id()
    )
  );
