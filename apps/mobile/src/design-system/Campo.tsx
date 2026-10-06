import { StyleSheet, Text, TextInput } from 'react-native';

import { colors, spacing } from './tokens';

interface CampoProps {
  label: string;
  value: string;
  onChangeText: (valor: string) => void;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences';
  placeholder?: string;
  multiline?: boolean;
}

export function Campo({
  label,
  value,
  onChangeText,
  secureTextEntry,
  autoCapitalize = 'sentences',
  placeholder,
  multiline,
}: CampoProps) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline ? styles.multilinha : null]}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        placeholder={placeholder}
        multiline={multiline}
      />
    </>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.text, marginBottom: spacing.xs, marginTop: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: spacing.sm,
    color: colors.text,
  },
  multilinha: { minHeight: 96, textAlignVertical: 'top' },
});
