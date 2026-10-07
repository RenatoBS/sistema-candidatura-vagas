import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, tipo } from './tokens';

interface EstadoVazioProps {
  titulo: string;
  texto?: string;
}

export function EstadoVazio({ titulo, texto }: EstadoVazioProps) {
  return (
    <View style={styles.caixa}>
      <Text style={styles.titulo}>{titulo}</Text>
      {texto ? <Text style={styles.texto}>{texto}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  caixa: { paddingVertical: spacing.xl, gap: spacing.sm },
  titulo: { ...tipo.destaque, color: colors.text, textAlign: 'center' },
  texto: { ...tipo.corpo, color: colors.textMuted, textAlign: 'center' },
});
