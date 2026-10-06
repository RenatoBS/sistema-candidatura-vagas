import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/cliente';
import { useAuth } from '@/auth/AuthContext';
import { colors, spacing } from '@/design-system/tokens';
import { useConsulta } from '@/hooks/useConsulta';

interface EmpresaItem {
  id: string;
  nomeFantasia: string;
  statusVerificacao: string;
}

export default function EmpresasAdminScreen() {
  const { t } = useTranslation();
  const { accessToken } = useAuth();
  const consulta = useConsulta(['empresas-admin'], () => api<EmpresaItem[]>('/admin/empresas', {}, accessToken), null);

  return (
    <View style={styles.tela}>
      <Text style={styles.titulo}>{t('admin.empresas')}</Text>
      {(consulta.data ?? []).map((empresa) => (
        <Text key={empresa.id} style={styles.texto}>
          {empresa.nomeFantasia} · {empresa.statusVerificacao}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, padding: spacing.lg, backgroundColor: colors.background },
  titulo: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  texto: { color: colors.text, marginBottom: spacing.sm },
});
