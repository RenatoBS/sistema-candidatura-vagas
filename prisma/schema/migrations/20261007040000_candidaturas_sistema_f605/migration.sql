-- F6-05: leituras internas de candidaturas são necessárias para o portal do candidato
-- e para deduplicar o match. O bypass só é ativado pelo contexto transacional interno.
CREATE POLICY candidaturas_sistema ON candidaturas
  FOR ALL USING (current_setting('app.is_system', true) = 'true')
  WITH CHECK (current_setting('app.is_system', true) = 'true');
