import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/cliente';
import { colors, spacing } from '@/design-system/tokens';
import { useConsulta } from '@/hooks/useConsulta';

interface VagaPublica {
  id: string;
  titulo: string;
  senioridade: string;
  modelo: string;
  localidade: string | null;
  prazoInscricoesBrasilia: string | null;
}

export default function VagasCandidatoScreen() {
  const { t } = useTranslation();
  const vagas = useConsulta(['vagas-publicas'], () => api<VagaPublica[]>('/vagas-publicas'), null);

  return (
    <View style={styles.tela}>
      <Text style={styles.titulo}>{t('candidato.vagas')}</Text>
      {(vagas.data ?? []).length === 0 ? <Text style={styles.texto}>{t('vaga.vazia')}</Text> : null}
      {(vagas.data ?? []).map((vaga) => (
        <Link key={vaga.id} href={`/candidato/vagas/${vaga.id}`}>
          <Text style={styles.item}>
            {vaga.titulo}
            {'\n'}
            {vaga.senioridade} · {vaga.modelo}
            {vaga.localidade ? ` · ${vaga.localidade}` : ''}
            {'\n'}
            {t('vaga.ate')}: {vaga.prazoInscricoesBrasilia ?? '—'}
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
  item: { color: colors.text, marginTop: spacing.md },
});
