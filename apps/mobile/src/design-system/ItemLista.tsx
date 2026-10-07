import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { estilos } from './estilos';
import { colors, radius, spacing, toque } from './tokens';

interface ItemListaProps {
  titulo: string;
  detalhe?: string;
  onPress: () => void;
  icone?: keyof typeof Ionicons.glyphMap;
}

export function ItemLista({ titulo, detalhe, onPress, icone }: ItemListaProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.item, pressed ? styles.pressionado : null]}
    >
      {icone ? <View style={styles.icone}><Ionicons name={icone} size={19} color={colors.primary} /></View> : null}
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
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  textos: { flex: 1, gap: spacing.xs },
  icone: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.primarySoft },
  pressionado: { opacity: 0.92, transform: [{ scale: 0.99 }] },
});
