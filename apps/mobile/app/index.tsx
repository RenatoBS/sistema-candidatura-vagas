import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/design-system/Button';
import { colors } from '@/design-system/tokens';

export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('home.title')}</Text>
      <Text style={styles.subtitle}>{t('home.subtitle')}</Text>
      <Text style={styles.phase}>{t('home.phase')}</Text>
      <Button label={t('home.entrar')} onPress={() => router.push('/login')} />
      <Button label={t('home.cadastrar')} onPress={() => router.push('/cadastro')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: colors.background,
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: colors.textMuted,
    marginBottom: 16,
    textAlign: 'center',
  },
  phase: {
    fontSize: 14,
    color: colors.primary,
    marginBottom: 24,
    textAlign: 'center',
  },
});
