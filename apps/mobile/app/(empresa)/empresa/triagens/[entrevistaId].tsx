import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';

import { api, ErroApi } from '@/api/cliente';
import { useAuth } from '@/auth/AuthContext';
import { Banner } from '@/design-system/Banner';
import { Button } from '@/design-system/Button';
import { Campo } from '@/design-system/Campo';
import { colors, spacing } from '@/design-system/tokens';
import { useConsulta } from '@/hooks/useConsulta';

interface RespostaTriagem {
  id: string;
  transcricao: string | null;
  nota: number | null;
  notaOrigem: string | null;
  statusTranscricao: string | null;
}

interface DetalheTriagem {
  id: string;
  status: string;
  retryAtual: number;
  perguntaAtual: number;
  respostas: RespostaTriagem[];
}

export default function DetalheTriagemScreen() {
  const { t } = useTranslation();
  const { entrevistaId } = useLocalSearchParams<{ entrevistaId: string }>();
  const { sessao, accessToken } = useAuth();
  const empresaId = sessao?.empresaAtivaId ?? sessao?.empresas[0]?.empresaId ?? '';
  const consulta = useConsulta(
    ['triagem', entrevistaId ?? ''],
    () => api<DetalheTriagem>(`/empresas/${empresaId}/triagens/${entrevistaId}`, {}, accessToken),
    empresaId,
  );
  const [motivo, setMotivo] = useState('');
  const [nota, setNota] = useState('');
  const [justificativa, setJustificativa] = useState('');
  const [erro, setErro] = useState('');
  const dados = consulta.data;

  async function ouvir(respostaId: string) {
    setErro('');
    try {
      const audio = await api<{ url: string }>(
        `/empresas/${empresaId}/triagens/${entrevistaId}/respostas/${respostaId}/audio?motivo=${encodeURIComponent(motivo)}`,
        {},
        accessToken,
      );
      await Linking.openURL(audio.url);
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : t('comum.erro'));
    }
  }

  async function revisar(respostaId: string) {
    setErro('');
    try {
      await api(
        `/empresas/${empresaId}/triagens/${entrevistaId}/respostas/${respostaId}/revisao`,
        { method: 'POST', body: JSON.stringify({ nota: Number(nota), justificativa }) },
        accessToken,
      );
      await consulta.refetch();
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : t('comum.erro'));
    }
  }

  return (
    <ScrollView style={styles.tela} contentContainerStyle={styles.conteudo}>
      <Text style={styles.titulo}>{t('triagem.detalhe')}</Text>
      {erro ? <Banner tipo="erro" texto={erro} /> : null}
      <Text style={styles.texto}>
        {t('triagem.status')}: {dados?.status ?? '—'}
      </Text>
      <Text style={styles.texto}>
        {t('triagem.retries')}: {dados?.retryAtual ?? 0}
      </Text>
      <Text style={styles.texto}>
        {t('triagem.pergunta')}: {dados?.perguntaAtual ?? 0}
      </Text>
      <Campo label={t('triagem.motivo')} value={motivo} onChangeText={setMotivo} />
      <Campo label={t('triagem.nota')} value={nota} onChangeText={setNota} />
      <Campo label={t('triagem.justificativa')} value={justificativa} onChangeText={setJustificativa} />
      {(dados?.respostas ?? []).map((resposta) => (
        <View key={resposta.id} style={styles.bloco}>
          <Text style={styles.texto}>
            {t('triagem.transcricao')}: {resposta.transcricao ?? '—'}
          </Text>
          <Text style={styles.texto}>
            {t('triagem.nota')}: {resposta.nota ?? '—'} ({resposta.notaOrigem ?? '—'})
          </Text>
          <Button label={t('triagem.audio')} variante="secundario" onPress={() => void ouvir(resposta.id)} />
          <Button label={t('triagem.revisar')} onPress={() => void revisar(resposta.id)} />
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  conteudo: { padding: spacing.lg, gap: spacing.sm },
  titulo: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  texto: { color: colors.text },
  bloco: { gap: spacing.sm, marginTop: spacing.md },
});
