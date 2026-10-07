import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, tipo, toque } from './tokens';

interface SeletorProps<T extends string> {
  label: string;
  opcoes: ReadonlyArray<{ valor: T; rotulo: string }>;
  valor: T;
  onChange: (valor: T) => void;
}

export function Seletor<T extends string>({ label, opcoes, valor, onChange }: SeletorProps<T>) {
  return (
    <View style={styles.grupo} accessibilityRole="radiogroup" accessibilityLabel={label}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.opcoes}>
        {opcoes.map((opcao) => {
          const ativo = opcao.valor === valor;
          return (
            <Pressable
              key={opcao.valor}
              accessibilityRole="radio"
              accessibilityState={{ selected: ativo, checked: ativo }}
              accessibilityLabel={opcao.rotulo}
              onPress={() => onChange(opcao.valor)}
              style={({ pressed }) => [styles.opcao, ativo ? styles.ativo : null, pressed ? styles.pressionado : null]}
            >
              <Text style={[styles.texto, ativo ? styles.textoAtivo : null]}>{opcao.rotulo}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grupo: { gap: spacing.xs, alignSelf: 'stretch' },
  label: { ...tipo.legenda, color: colors.text },
  opcoes: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  opcao: {
    minHeight: toque.minAltura,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  ativo: { backgroundColor: colors.primary, borderColor: colors.primary },
  pressionado: { opacity: 0.85 },
  texto: { ...tipo.destaque, color: colors.text },
  textoAtivo: { color: colors.onPrimary },
});
