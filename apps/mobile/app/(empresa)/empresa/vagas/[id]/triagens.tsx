import { Link, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { api } from '@/api/cliente';
import { useAuth } from '@/auth/AuthContext';
import { colors, spacing } from '@/design-system/tokens';
import { useConsulta } from '@/hooks/useConsulta';

interface TriagemResumo {
  id: string;
  status: string;
  retryAtual: number;
  perguntaAtual: number;
}

export default function TriagensDaVaga() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { sessao, accessToken } = useAuth();
  const empresaId = sessao?.empresaAtivaId ?? sessao?.empresas[0]?.empresaId ?? '';
  const consulta = useConsulta(
    ['triagens', id ?? ''],
    () => api<{ itens: TriagemResumo[] }>(`/empresas/${empresaId}/vagas/${id}/triagens`, {}, accessToken),
    empresaId,
  );
  const itens = consulta.data?.itens ?? [];

  return (
    <ScrollView style={styles.tela} contentContainerStyle={styles.conteudo}>
      <Text style={styles.titulo}>{t('triagem.titulo')}</Text>
      {itens.length === 0 ? <Text style={styles.texto}>{t('triagem.vazia')}</Text> : null}
      {itens.map((item) => (
        <Link key={item.id} href={`/empresa/triagens/${item.id}`} style={styles.link}>
          {`${t('triagem.status')}: ${item.status} · ${t('triagem.retries')}: ${item.retryAtual}`}
        </Link>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  conteudo: { padding: spacing.lg, gap: spacing.sm },
  titulo: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  texto: { color: colors.text },
  link: { color: colors.primary, fontSize: 16 },
});
