import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, tipo } from './tokens';

interface MarcaProps {
  compacta?: boolean;
}

export function Marca({ compacta = false }: MarcaProps) {
  return (
    <View style={[styles.linha, compacta ? styles.linhaCompacta : null]}>
      <View style={[styles.simbolo, compacta ? styles.simboloCompacto : null]}>
        <Ionicons name="sparkles" size={compacta ? 18 : 24} color={colors.onPrimary} />
      </View>
      <View>
        <Text style={[styles.nome, compacta ? styles.nomeCompacto : null]}>Vitta</Text>
        {!compacta ? <Text style={styles.descritor}>talentos que avançam</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  linhaCompacta: { gap: 8 },
  simbolo: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  simboloCompacto: { width: 36, height: 36, borderRadius: 12 },
  nome: { ...tipo.secao, color: colors.text, letterSpacing: -0.5 },
  nomeCompacto: { fontSize: 18, lineHeight: 22 },
  descritor: { ...tipo.legenda, color: colors.textMuted, marginTop: -2 },
});
