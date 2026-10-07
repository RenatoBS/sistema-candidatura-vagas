import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing } from './tokens';

interface TelaProps {
  children: ReactNode;
  rolar?: boolean;
  teclado?: boolean;
  comAbas?: boolean;
  centralizar?: boolean;
  rodape?: ReactNode;
}

export function Tela({ children, rolar = true, teclado = false, comAbas = false, centralizar = false, rodape }: TelaProps) {
  const insets = useSafeAreaInsets();
  const conteudo = rolar ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.conteudo, centralizar ? styles.centralizar : null]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.conteudo, styles.estica, centralizar ? styles.centralizar : null]}>{children}</View>
  );

  const corpo = (
    <View style={styles.flex}>
      {conteudo}
      {rodape ? (
        <View style={[styles.rodape, { paddingBottom: comAbas ? spacing.md : Math.max(insets.bottom, spacing.md) }]}>
          {rodape}
        </View>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.tela} edges={comAbas ? ['top', 'left', 'right'] : ['top', 'left', 'right', 'bottom']}>
      {teclado ? (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {corpo}
        </KeyboardAvoidingView>
      ) : (
        corpo
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  estica: { flex: 1 },
  conteudo: {
    paddingHorizontal: 20,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: 18,
  },
  centralizar: { flexGrow: 1, justifyContent: 'center' },
  rodape: {
    paddingHorizontal: 20,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
});
