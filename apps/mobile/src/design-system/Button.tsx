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
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  primario: { backgroundColor: colors.primary, shadowColor: colors.primary, shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  secundario: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  perigo: { backgroundColor: colors.danger },
  texto: { backgroundColor: 'transparent' },
  pressionado: { opacity: 0.88, transform: [{ scale: 0.985 }] },
  desabilitado: { opacity: 0.5 },
  label: { ...tipo.destaque, color: colors.onPrimary, textAlign: 'center' },
  labelEscuro: { color: colors.text },
  labelTexto: { color: colors.primary },
});
