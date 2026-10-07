import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, tipo } from './tokens';

interface MarcaProps {
  compacta?: boolean;
}

export function Marca({ compacta = false }: MarcaProps) {
  const { t } = useTranslation();

  return (
    <View style={[styles.linha, compacta ? styles.linhaCompacta : null]}>
      <View style={[styles.simbolo, compacta ? styles.simboloCompacto : null]}>
        <Ionicons name="sparkles" size={compacta ? 18 : 24} color={colors.onPrimary} />
      </View>
      <View style={styles.textos}>
        <Text style={[styles.nome, compacta ? styles.nomeCompacto : null]} numberOfLines={2}>
          {t('home.title')}
        </Text>
        {!compacta ? <Text style={styles.descritor}>{t('home.phase')}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', gap: 10, maxWidth: '100%' },
  linhaCompacta: { gap: 8 },
  simbolo: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  simboloCompacto: { width: 36, height: 36, borderRadius: 12 },
  textos: { flexShrink: 1 },
  nome: { ...tipo.secao, color: colors.text, letterSpacing: -0.5 },
  nomeCompacto: { fontSize: 18, lineHeight: 22 },
  descritor: { ...tipo.legenda, color: colors.textMuted, marginTop: -2 },
});
