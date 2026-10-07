import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/design-system/Button';
import { Tela } from '@/design-system/Tela';
import { colors, spacing, tipo } from '@/design-system/tokens';

export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <Tela centralizar rolar={false}>
      <View style={styles.bloco}>
        <Text style={styles.titulo}>{t('home.title')}</Text>
        <Text style={styles.subtitulo}>{t('home.subtitle')}</Text>
        <Text style={styles.fase}>{t('home.phase')}</Text>
      </View>
      <View style={styles.acoes}>
        <Button label={t('home.entrar')} onPress={() => router.push('/login')} />
        <Button label={t('home.cadastrar')} variante="secundario" onPress={() => router.push('/cadastro')} />
      </View>
    </Tela>
  );
}

const styles = StyleSheet.create({
  bloco: { gap: spacing.sm },
  titulo: { ...tipo.titulo, color: colors.text },
  subtitulo: { ...tipo.corpo, color: colors.textMuted },
  fase: { ...tipo.legenda, color: colors.primary },
  acoes: { gap: spacing.sm, marginTop: spacing.lg },
});
