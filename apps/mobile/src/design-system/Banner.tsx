import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from './tokens';

interface BannerProps {
  tipo: 'aviso' | 'erro' | 'ok';
  texto: string;
}

export function Banner({ tipo, texto }: BannerProps) {
  return (
    <View style={[styles.base, tipo === 'erro' ? styles.erro : tipo === 'ok' ? styles.ok : styles.aviso]}>
      <Text style={styles.texto}>{texto}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { padding: spacing.md, borderRadius: 8, marginBottom: spacing.md },
  aviso: { backgroundColor: colors.warningSurface },
  erro: { backgroundColor: colors.dangerSurface },
  ok: { backgroundColor: colors.successSurface },
  texto: { color: colors.text },
});
