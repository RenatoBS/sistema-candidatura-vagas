-- A orquestração da triagem roda como job interno (app.is_system), sem usuário da empresa.
-- Sem estas políticas o processo, as perguntas e o nome da empresa ficam invisíveis e a triagem não começa.

CREATE POLICY processos_seletivos_sistema ON processos_seletivos
  FOR ALL
  USING (current_setting('app.is_system', true) = 'true')
  WITH CHECK (current_setting('app.is_system', true) = 'true');

CREATE POLICY etapas_sistema ON etapas
  FOR ALL
  USING (current_setting('app.is_system', true) = 'true')
  WITH CHECK (current_setting('app.is_system', true) = 'true');

CREATE POLICY etapas_perguntas_sistema ON etapas_perguntas
  FOR ALL
  USING (current_setting('app.is_system', true) = 'true')
  WITH CHECK (current_setting('app.is_system', true) = 'true');

CREATE POLICY perguntas_sistema ON perguntas
  FOR ALL
  USING (current_setting('app.is_system', true) = 'true')
  WITH CHECK (current_setting('app.is_system', true) = 'true');

CREATE POLICY empresas_sistema ON empresas
  FOR ALL
  USING (current_setting('app.is_system', true) = 'true')
  WITH CHECK (current_setting('app.is_system', true) = 'true');
