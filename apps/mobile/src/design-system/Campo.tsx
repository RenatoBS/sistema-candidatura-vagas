import { StyleSheet, Text, TextInput, View } from 'react-native';

import { estilos } from './estilos';
import { colors, radius, spacing, tipo, toque } from './tokens';

interface CampoProps {
  label: string;
  value: string;
  onChangeText: (valor: string) => void;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences';
  placeholder?: string;
  multiline?: boolean;
  erro?: string;
  keyboardType?: 'default' | 'decimal-pad' | 'email-address' | 'number-pad';
}

export function Campo({
  label,
  value,
  onChangeText,
  secureTextEntry,
  autoCapitalize = 'sentences',
  placeholder,
  multiline,
  erro,
  keyboardType = 'default',
}: CampoProps) {
  return (
    <View style={styles.grupo}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline ? styles.multilinha : null, erro ? styles.inputErro : null]}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        multiline={multiline}
        keyboardType={keyboardType}
      />
      {erro ? <Text style={estilos.erro}>{erro}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  grupo: { gap: spacing.xs, alignSelf: 'stretch' },
  label: { ...tipo.legenda, color: colors.text },
  input: {
    minHeight: toque.minAltura,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    ...tipo.corpo,
  },
  inputErro: { borderColor: colors.danger },
  multilinha: { minHeight: 120, textAlignVertical: 'top' },
});
