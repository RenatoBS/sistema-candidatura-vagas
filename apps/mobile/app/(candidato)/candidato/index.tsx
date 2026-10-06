import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { TrocaVisao } from '@/componentes/TrocaVisao';
import { colors, spacing } from '@/design-system/tokens';

export default function CandidatoHome() {
  const { t } = useTranslation();
  return (
    <View style={styles.tela}>
      <Text style={styles.titulo}>{t('candidato.titulo')}</Text>
      <Text style={styles.texto}>{t('candidato.texto')}</Text>
      <TrocaVisao />
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, padding: spacing.lg, backgroundColor: colors.background },
  titulo: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  texto: { color: colors.textMuted, marginBottom: spacing.md },
});
