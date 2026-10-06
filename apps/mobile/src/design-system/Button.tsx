import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, spacing } from './tokens';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variante?: 'primario' | 'secundario' | 'perigo';
}

export function Button({ label, onPress, variante = 'primario' }: ButtonProps) {
  return (
    <Pressable
      style={[styles.button, variante === 'secundario' ? styles.secundario : null, variante === 'perigo' ? styles.perigo : null]}
      onPress={onPress}
    >
      <Text style={[styles.label, variante === 'secundario' ? styles.labelSecundario : null]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 8,
  },
  secundario: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  perigo: { backgroundColor: colors.danger },
  label: {
    color: colors.onPrimary,
    fontWeight: '600',
    fontSize: 16,
  },
  labelSecundario: { color: colors.text },
});
