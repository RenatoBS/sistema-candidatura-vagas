import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/cliente';
import { useAuth } from '@/auth/AuthContext';
import { Banner } from '@/design-system/Banner';
import { colors, spacing } from '@/design-system/tokens';
import { useConsulta } from '@/hooks/useConsulta';

interface Instancia {
  id: string;
  nomeFantasia: string | null;
  status: string;
  numero: string | null;
  ultimaConexaoEm: string | null;
}

export default function WhatsappAdminScreen() {
  const { t } = useTranslation();
  const { accessToken } = useAuth();
  const consulta = useConsulta(
    ['whatsapp-admin'],
    () => api<Instancia[]>('/admin/whatsapp/instancias', {}, accessToken),
    null,
  );

  return (
    <View style={styles.tela}>
      <Text style={styles.titulo}>{t('admin.whatsapp')}</Text>
      {(consulta.data ?? []).map((instancia) => (
        <View key={instancia.id} style={styles.item}>
          <Text style={styles.texto}>
            {instancia.nomeFantasia ?? '—'} · {instancia.status}
          </Text>
          <Text style={styles.texto}>
            {t('whatsapp.numero')}: {instancia.numero ?? t('whatsapp.semNumero')}
          </Text>
          <Text style={styles.texto}>
            {t('whatsapp.ultima')}: {instancia.ultimaConexaoEm ?? t('whatsapp.semConexao')}
          </Text>
          {instancia.status !== 'CONECTADA' ? <Banner tipo="aviso" texto={t('whatsapp.banner')} /> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, padding: spacing.lg, backgroundColor: colors.background },
  titulo: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  texto: { color: colors.text },
  item: { marginBottom: spacing.md },
});
