import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, tipo } from './tokens';

interface ChipProps {
  texto: string;
  tom?: 'neutro' | 'destaque' | 'sucesso' | 'aviso';
}

export function Chip({ texto, tom = 'neutro' }: ChipProps) {
  return (
    <View style={[styles.chip, tom === 'destaque' ? styles.destaque : null, tom === 'sucesso' ? styles.sucesso : null, tom === 'aviso' ? styles.aviso : null]}>
      <Text style={[styles.texto, tom === 'destaque' ? styles.textoDestaque : null, tom === 'sucesso' ? styles.textoSucesso : null, tom === 'aviso' ? styles.textoAviso : null]}>{texto}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  texto: { ...tipo.legenda, color: colors.text },
  destaque: { backgroundColor: colors.primarySoft, borderColor: colors.primarySoft },
  sucesso: { backgroundColor: colors.successSurface, borderColor: colors.successSurface },
  aviso: { backgroundColor: colors.warningSurface, borderColor: colors.warningSurface },
  textoDestaque: { color: colors.primaryStrong },
  textoSucesso: { color: colors.success },
  textoAviso: { color: colors.warning },
});
