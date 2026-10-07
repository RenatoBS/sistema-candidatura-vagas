import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, radius, spacing, tipo, toque } from './tokens';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variante?: 'primario' | 'secundario' | 'perigo' | 'texto';
  desabilitado?: boolean;
}

export function Button({ label, onPress, variante = 'primario', desabilitado = false }: ButtonProps) {
  const texto = variante === 'texto';
  return (
    <Pressable
      accessibilityRole="button"
      disabled={desabilitado}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variante === 'primario' ? styles.primario : null,
        variante === 'secundario' ? styles.secundario : null,
        variante === 'perigo' ? styles.perigo : null,
        texto ? styles.texto : null,
        pressed && !desabilitado ? styles.pressionado : null,
        desabilitado ? styles.desabilitado : null,
      ]}
    >
      <Text
        style={[
          styles.label,
          variante === 'secundario' || texto ? styles.labelEscuro : null,
          texto ? styles.labelTexto : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: toque.minAltura,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  primario: { backgroundColor: colors.primary },
  secundario: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  perigo: { backgroundColor: colors.danger },
  texto: { backgroundColor: 'transparent' },
  pressionado: { opacity: 0.85 },
  desabilitado: { opacity: 0.5 },
  label: { ...tipo.destaque, color: colors.onPrimary, textAlign: 'center' },
  labelEscuro: { color: colors.text },
  labelTexto: { color: colors.primary },
});
