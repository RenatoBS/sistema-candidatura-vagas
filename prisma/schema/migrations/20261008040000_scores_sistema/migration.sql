-- O recálculo do ranking roda como job interno (app.is_system), sem empresa na sessão.
-- A política antiga exigia app_current_empresa_id() igual ao da candidatura, então o score não era gravado.

CREATE POLICY scores_sistema ON scores
  FOR ALL
  USING (current_setting('app.is_system', true) = 'true')
  WITH CHECK (current_setting('app.is_system', true) = 'true');
