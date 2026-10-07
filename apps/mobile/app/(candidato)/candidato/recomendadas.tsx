import { Link } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '@/api/cliente';
import { useAuth } from '@/auth/AuthContext';
import { colors, spacing } from '@/design-system/tokens';
import { useConsulta } from '@/hooks/useConsulta';
type V = { id: string; titulo: string; habilidadesEmComum?: string[] };
export default function Recomendadas() {
  const { accessToken } = useAuth();
  const q = useConsulta<{ vagas: V[]; visivelParaMatch: boolean }>(['recomendadas'], () =>
    api<{ vagas: V[]; visivelParaMatch: boolean }>(
      '/candidatos/me/vagas-recomendadas',
      {},
      accessToken,
    ),
  );
  if (q.isLoading) return <ActivityIndicator style={s.estado} color={colors.primary} />;
  if (q.isError) return <Text style={s.x}>Não foi possível carregar as recomendações.</Text>;
  return (
    <ScrollView style={s.tela} contentContainerStyle={s.c}>
      <Text style={s.t}>Vagas recomendadas</Text>
      {!q.data?.visivelParaMatch ? (
        <Text style={s.x}>
          Ative a visibilidade para match em Privacidade para receber recomendações.
        </Text>
      ) : null}
      {(q.data?.vagas ?? []).length === 0 && q.data?.visivelParaMatch ? (
        <Text style={s.x}>Nenhuma vaga recomendada no momento.</Text>
      ) : null}
      {(q.data?.vagas ?? []).map((v) => (
        <View style={s.card} key={v.id}>
          <Text style={s.t2}>{v.titulo}</Text>
          <Text style={s.x}>
            {v.habilidadesEmComum?.length
              ? `Habilidades em comum: ${v.habilidadesEmComum.join(', ')}`
              : 'Veja os detalhes desta vaga.'}
          </Text>
          <Link href={`/candidato/vagas/${v.id}`} style={s.link}>
            Ver vaga
          </Link>
        </View>
      ))}
    </ScrollView>
  );
}
const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  c: { padding: spacing.lg, gap: spacing.md },
  t: { fontSize: 22, fontWeight: '700', color: colors.text },
  t2: { fontWeight: '700', color: colors.text },
  x: { color: colors.text },
  link: { color: colors.primary },
  card: { backgroundColor: colors.surface, padding: spacing.md, gap: spacing.sm },
  estado: { flex: 1 },
});
