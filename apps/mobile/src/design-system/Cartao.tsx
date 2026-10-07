import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, elevacao, radius } from './tokens';

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
    padding: 18,
    gap: 10,
    ...elevacao.cartao,
  },
  destaque: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  pressionado: { opacity: 0.94, transform: [{ scale: 0.99 }] },
});
