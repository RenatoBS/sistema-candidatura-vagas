import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, elevacao, radius, spacing } from './tokens';

interface CartaoProps {
  children: ReactNode;
  onPress?: () => void;
  destaque?: boolean;
}

export function Cartao({ children, onPress, destaque = false }: CartaoProps) {
  if (!onPress) {
    return <View style={[styles.cartao, destaque ? styles.destaque : null]}>{children}</View>;
  }
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.cartao, destaque ? styles.destaque : null, pressed ? styles.pressionado : null]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cartao: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
    ...elevacao.cartao,
  },
  destaque: { borderLeftWidth: 4, borderLeftColor: colors.primary },
  pressionado: { opacity: 0.92 },
});
