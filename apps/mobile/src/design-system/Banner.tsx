import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, tipo } from './tokens';

interface BannerProps {
  tipo: 'aviso' | 'erro' | 'ok';
  texto: string;
}

export function Banner({ tipo, texto }: BannerProps) {
  return (
    <View style={[styles.base, tipo === 'erro' ? styles.erro : tipo === 'ok' ? styles.ok : styles.aviso]}>
      <Text style={[styles.texto, tipo === 'erro' ? styles.textoErro : tipo === 'ok' ? styles.textoOk : styles.textoAviso]}>
        {texto}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { padding: spacing.md, borderRadius: radius.md, alignSelf: 'stretch' },
  aviso: { backgroundColor: colors.warningSurface },
  erro: { backgroundColor: colors.dangerSurface },
  ok: { backgroundColor: colors.successSurface },
  texto: { ...tipo.corpo, color: colors.text },
  textoAviso: { color: colors.warning },
  textoErro: { color: colors.danger },
  textoOk: { color: colors.success },
});
