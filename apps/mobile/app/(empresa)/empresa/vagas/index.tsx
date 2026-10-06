import { Link } from 'expo-router';
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

interface VagaResumo {
  id: string;
  titulo: string;
  status: string;
  prazoInscricoesBrasilia: string | null;
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
  const vagas = useConsulta(['vagas-empresa'], () => api<VagaResumo[]>(`/empresas/${empresaId}/vagas`, {}, accessToken), empresaId);
  const desconectada = whatsapp.data?.status !== 'CONECTADA';

  return (
    <View style={styles.tela}>
      <Text style={styles.titulo}>{t('empresa.vagas')}</Text>
      {desconectada ? <Banner tipo="aviso" texto={t('whatsapp.banner')} /> : null}
      <Link href="/empresa/vagas/nova">{t('vaga.nova')}</Link>
      {(vagas.data ?? []).length === 0 ? <Text style={styles.texto}>{t('vaga.vazia')}</Text> : null}
      {(vagas.data ?? []).map((vaga) => (
        <Link key={vaga.id} href={`/empresa/vagas/${vaga.id}`}>
          <Text style={styles.item}>
            {vaga.titulo} — {vaga.status}
            {vaga.prazoInscricoesBrasilia ? ` — ${vaga.prazoInscricoesBrasilia}` : ''}
          </Text>
        </Link>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, padding: spacing.lg, backgroundColor: colors.background, gap: spacing.sm },
  titulo: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  texto: { color: colors.textMuted },
  item: { color: colors.text, marginTop: spacing.sm },
});
