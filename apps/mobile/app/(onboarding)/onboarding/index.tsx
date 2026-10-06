import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/cliente';
import { useAuth } from '@/auth/AuthContext';
import { TrocaVisao } from '@/componentes/TrocaVisao';
import { Button } from '@/design-system/Button';
import { Campo } from '@/design-system/Campo';
import { colors, spacing } from '@/design-system/tokens';

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const { accessToken, entrar } = useAuth();
  const router = useRouter();
  const [nome, setNome] = useState('');

  async function candidato() {
    const tokens = await api<{ accessToken: string; refreshToken: string }>(
      '/onboarding/candidato',
      { method: 'POST', body: JSON.stringify({ nome }) },
      accessToken,
    );
    await entrar(tokens);
    router.replace('/candidato');
  }

  return (
    <View style={styles.tela}>
      <Text style={styles.titulo}>{t('onboarding.titulo')}</Text>
      <Campo label={t('onboarding.nome')} value={nome} onChangeText={setNome} />
      <Button label={t('onboarding.candidato')} onPress={() => void candidato()} />
      <Button label={t('onboarding.empresa')} onPress={() => router.push('/onboarding/empresa')} />
      <TrocaVisao />
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, padding: spacing.lg, backgroundColor: colors.background, gap: spacing.sm },
  titulo: { fontSize: 22, fontWeight: '700', color: colors.text },
});
