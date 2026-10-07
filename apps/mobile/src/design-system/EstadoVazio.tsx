import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, tipo } from './tokens';

interface EstadoVazioProps {
  titulo: string;
  texto?: string;
}

export function EstadoVazio({ titulo, texto }: EstadoVazioProps) {
  return (
    <View style={styles.caixa}>
      <View style={styles.icone}><Ionicons name="sparkles-outline" size={26} color={colors.primary} /></View>
      <Text style={styles.titulo}>{titulo}</Text>
      {texto ? <Text style={styles.texto}>{texto}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  caixa: { paddingVertical: spacing.xl, paddingHorizontal: spacing.lg, gap: spacing.sm, alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  icone: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft, marginBottom: spacing.xs },
  titulo: { ...tipo.destaque, color: colors.text, textAlign: 'center' },
  texto: { ...tipo.corpo, color: colors.textMuted, textAlign: 'center' },
});
