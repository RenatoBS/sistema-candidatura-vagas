import { Link } from 'expo-router';
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
      <Link href="/candidato/perfil">{t('candidato.perfil')}</Link>
      <Link href="/candidato/curriculo">{t('candidato.curriculo')}</Link>
      <Link href="/candidato/habilidades">{t('candidato.habilidades')}</Link>
      <Link href="/candidato/privacidade">{t('candidato.privacidade')}</Link>
      <Link href="/candidato/dados">{t('candidato.dados')}</Link>
      <TrocaVisao />
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, padding: spacing.lg, backgroundColor: colors.background },
  titulo: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  texto: { color: colors.textMuted, marginBottom: spacing.md },
});
