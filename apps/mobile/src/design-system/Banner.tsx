import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, tipo } from './tokens';

interface BannerProps {
  tipo: 'aviso' | 'erro' | 'ok';
  texto: string;
}

export function Banner({ tipo, texto }: BannerProps) {
  return (
    <View style={[styles.base, tipo === 'erro' ? styles.erro : tipo === 'ok' ? styles.ok : styles.aviso]}>
      <Ionicons name={tipo === 'erro' ? 'alert-circle' : tipo === 'ok' ? 'checkmark-circle' : 'information-circle'} size={20} color={tipo === 'erro' ? colors.danger : tipo === 'ok' ? colors.success : colors.warning} />
      <Text style={[styles.texto, tipo === 'erro' ? styles.textoErro : tipo === 'ok' ? styles.textoOk : styles.textoAviso]}>
        {texto}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { padding: 14, borderRadius: radius.md, alignSelf: 'stretch', flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  aviso: { backgroundColor: colors.warningSurface },
  erro: { backgroundColor: colors.dangerSurface },
  ok: { backgroundColor: colors.successSurface },
  texto: { ...tipo.corpo, color: colors.text, flex: 1 },
  textoAviso: { color: colors.warning },
  textoErro: { color: colors.danger },
  textoOk: { color: colors.success },
});
