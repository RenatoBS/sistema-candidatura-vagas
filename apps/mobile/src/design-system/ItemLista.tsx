import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { estilos } from './estilos';
import { colors, radius, spacing, toque } from './tokens';

interface ItemListaProps {
  titulo: string;
  detalhe?: string;
  onPress: () => void;
}

export function ItemLista({ titulo, detalhe, onPress }: ItemListaProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.item, pressed ? styles.pressionado : null]}
    >
      <View style={styles.textos}>
        <Text style={estilos.tituloItem}>{titulo}</Text>
        {detalhe ? <Text style={estilos.mudo}>{detalhe}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: {
    minHeight: toque.minAltura,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  textos: { flex: 1, gap: spacing.xs },
  pressionado: { opacity: 0.92 },
});
