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

interface RespostaVoz {
  id: string;
  transcricao: string | null;
  expirou: boolean;
}

interface DetalheVoz {
  status: string;
  respostas: RespostaVoz[];
}

export default function GravacaoVozScreen() {
  const { t } = useTranslation();
  const { entrevistaId } = useLocalSearchParams<{ entrevistaId: string }>();
  const { sessao, accessToken } = useAuth();
  const empresaId = sessao?.empresaAtivaId ?? sessao?.empresas[0]?.empresaId ?? '';
  const consulta = useConsulta(
    ['voz-detalhe', entrevistaId ?? ''],
    () => api<DetalheVoz>(`/empresas/${empresaId}/voz/${entrevistaId}`, {}, accessToken),
    empresaId,
  );
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');

  async function ouvir() {
    setErro('');
    try {
      const audio = await api<{ url: string }>(
        `/empresas/${empresaId}/voz/${entrevistaId}/gravacao?motivo=${encodeURIComponent(motivo)}`,
        {},
        accessToken,
      );
      await Linking.openURL(audio.url);
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : t('comum.erro'));
    }
  }

  return (
    <ScrollView style={styles.tela} contentContainerStyle={styles.conteudo}>
      <Text style={styles.titulo}>{t('voz.titulo')}</Text>
      {erro ? <Banner tipo="erro" texto={erro} /> : null}
      <Text style={styles.texto}>{consulta.data?.status ?? '—'}</Text>
      <Campo label={t('voz.motivo')} value={motivo} onChangeText={setMotivo} />
      <Button label={t('voz.gravacao')} onPress={() => void ouvir()} />
      {(consulta.data?.respostas ?? []).map((resposta) => (
        <View key={resposta.id} style={styles.bloco}>
          <Text style={styles.texto}>
            {t('voz.transcricao')}: {resposta.transcricao ?? '—'}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  conteudo: { padding: spacing.lg, gap: spacing.md },
  titulo: { fontSize: 22, fontWeight: '700', color: colors.text },
  texto: { color: colors.text },
  bloco: { gap: spacing.sm },
});
