import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/cliente';
import { useAuth } from '@/auth/AuthContext';
import { colors, spacing } from '@/design-system/tokens';
import { useConsulta } from '@/hooks/useConsulta';

interface Evento {
  id: string;
  acao: string;
  recursoTipo: string;
  motivo: string | null;
  criadoEm: string;
}

export default function AuditoriaScreen() {
  const { t } = useTranslation();
  const { accessToken } = useAuth();
  const consulta = useConsulta(['auditoria'], () => api<Evento[]>('/admin/auditoria', {}, accessToken), null);

  return (
    <View style={styles.tela}>
      <Text style={styles.titulo}>{t('admin.auditoria')}</Text>
      {(consulta.data ?? []).length === 0 ? <Text style={styles.texto}>{t('admin.vazia')}</Text> : null}
      {(consulta.data ?? []).map((evento) => (
        <Text key={evento.id} style={styles.texto}>
          {evento.acao} · {evento.recursoTipo} · {evento.motivo ?? '—'}
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
