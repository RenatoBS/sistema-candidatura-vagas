import { Link, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/cliente';
import { useAuth } from '@/auth/AuthContext';
import { colors, spacing } from '@/design-system/tokens';
import { useConsulta } from '@/hooks/useConsulta';

interface ItemVoz {
  id: string;
  status: string;
}

export default function ListaVozScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { sessao, accessToken } = useAuth();
  const empresaId = sessao?.empresaAtivaId ?? sessao?.empresas[0]?.empresaId ?? '';
  const consulta = useConsulta(
    ['voz', id ?? ''],
    () => api<{ itens: ItemVoz[] }>(`/empresas/${empresaId}/vagas/${id}/voz`, {}, accessToken),
    empresaId,
  );
  const itens = consulta.data?.itens ?? [];
  return (
    <View style={styles.tela}>
      <Text style={styles.titulo}>{t('vaga.voz')}</Text>
      {itens.length === 0 ? <Text style={styles.texto}>{t('voz.vazia')}</Text> : null}
      {itens.map((item) => (
        <Link key={item.id} href={`/empresa/voz/${item.id}`}>
          <Text style={styles.texto}>
            {item.status}
          </Text>
        </Link>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, padding: spacing.lg, backgroundColor: colors.background, gap: spacing.md },
  titulo: { fontSize: 22, fontWeight: '700', color: colors.text },
  texto: { color: colors.text },
});
