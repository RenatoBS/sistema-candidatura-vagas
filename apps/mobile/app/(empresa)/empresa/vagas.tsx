import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/cliente';
import { useAuth } from '@/auth/AuthContext';
import { Banner } from '@/design-system/Banner';
import { colors, spacing } from '@/design-system/tokens';
import { useConsulta } from '@/hooks/useConsulta';

interface StatusWhatsapp {
  status: string | null;
}

export default function VagasEmpresaScreen() {
  const { t } = useTranslation();
  const { sessao, accessToken } = useAuth();
  const empresaId = sessao?.empresaAtivaId ?? sessao?.empresas[0]?.empresaId ?? '';
  const whatsapp = useConsulta(
    ['whatsapp-vagas'],
    () => api<StatusWhatsapp>(`/empresas/${empresaId}/whatsapp/status`, {}, accessToken),
    empresaId,
  );
  const desconectada = whatsapp.data?.status !== 'CONECTADA';

  return (
    <View style={styles.tela}>
      <Text style={styles.titulo}>{t('empresa.vagas')}</Text>
      {desconectada ? <Banner tipo="aviso" texto={t('whatsapp.banner')} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, padding: spacing.lg, backgroundColor: colors.background },
  titulo: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
});
