import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, tipo } from '@/design-system/tokens';
import { chaveLegenda } from '@/dev/legendas';
import { AppProviders } from '@/providers/AppProviders';

export default function RootLayout() {
  return (
    <AppProviders>
      <StatusBar style="auto" />
      <FaixaLegenda />
      <Stack screenOptions={{ headerShown: false }} />
    </AppProviders>
  );
}

function FaixaLegenda() {
  const pathname = usePathname();
  const { t } = useTranslation();
  if (process.env.EXPO_PUBLIC_LEGENDAS_DEMO !== 'true') return null;
  const chave = chaveLegenda(pathname);
  if (!chave) return null;
  return (
    <View pointerEvents="none" style={styles.faixa}>
      <Text style={styles.texto}>{t(chave)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  faixa: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.md,
    right: spacing.md,
    zIndex: 20,
    backgroundColor: colors.text,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  texto: { ...tipo.destaque, color: colors.onPrimary, textAlign: 'center' },
});
