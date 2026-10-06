import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { TrocaVisao } from '@/componentes/TrocaVisao';
import { colors, spacing } from '@/design-system/tokens';

export default function AdminHome() {
  const { t } = useTranslation();
  return (
    <View style={styles.tela}>
      <Text style={styles.titulo}>{t('admin.titulo')}</Text>
      <Link href="/admin/verificacoes">{t('admin.fila')}</Link>
      <Link href="/admin/empresas">{t('admin.empresas')}</Link>
      <Link href="/admin/auditoria">{t('admin.auditoria')}</Link>
      <Link href="/admin/whatsapp">{t('admin.whatsapp')}</Link>
      <TrocaVisao />
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, padding: spacing.lg, backgroundColor: colors.background, gap: spacing.md },
  titulo: { fontSize: 22, fontWeight: '700', color: colors.text },
});
