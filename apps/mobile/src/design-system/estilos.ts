import { StyleSheet } from 'react-native';

import { colors, spacing, tipo } from './tokens';

export const estilos = StyleSheet.create({
  tituloItem: { ...tipo.destaque, color: colors.text },
  corpo: { ...tipo.corpo, color: colors.text },
  mudo: { ...tipo.corpo, color: colors.textMuted },
  legenda: { ...tipo.legenda, color: colors.textMuted },
  erro: { ...tipo.legenda, color: colors.danger },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  bloco: { gap: spacing.sm },
});
