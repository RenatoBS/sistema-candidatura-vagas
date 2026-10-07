import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, tipo } from './tokens';

interface ChipProps {
  texto: string;
}

export function Chip({ texto }: ChipProps) {
  return (
    <View style={styles.chip}>
      <Text style={styles.texto}>{texto}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: colors.background,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  texto: { ...tipo.legenda, color: colors.text },
});
