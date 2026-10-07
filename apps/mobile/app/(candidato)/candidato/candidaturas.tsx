import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '@/api/cliente';
import { useAuth } from '@/auth/AuthContext';
import { rotuloStatus } from '@/candidatura/regras';
import { colors, spacing } from '@/design-system/tokens';
import { useConsulta } from '@/hooks/useConsulta';
type C = {
  id: string;
  vaga?: { titulo: string };
  status?: string;
  fase?: string;
  rotuloAmigavel?: string;
};
export default function Candidaturas() {
  const { t } = useTranslation();
  const { accessToken } = useAuth();
  const q = useConsulta<C[]>(['candidaturas'], () =>
    api<C[]>('/candidatos/me/candidaturas', {}, accessToken),
  );
  if (q.isLoading) return <ActivityIndicator style={s.estado} color={colors.primary} />;
  if (q.isError) return <Text style={s.x}>Não foi possível carregar suas candidaturas.</Text>;
  return (
    <ScrollView style={s.tela} contentContainerStyle={s.c}>
      <Text style={s.t}>Minhas candidaturas</Text>
      {(q.data ?? []).length === 0 ? (
        <Text style={s.x}>Você ainda não se candidatou a nenhuma vaga.</Text>
      ) : null}
      {(q.data ?? []).length > 1 ? <Text style={s.x}>{t('candidato.variosProcessos')}</Text> : null}
      {(q.data ?? []).map((c) => (
        <View style={s.card} key={c.id}>
          <Text style={s.x}>{c.vaga?.titulo ?? 'Vaga'}</Text>
          <Text style={s.x}>{c.rotuloAmigavel ?? rotuloStatus(c.status, c.fase)}</Text>
          <Link href={`/candidato/candidaturas/${c.id}`} style={s.link}>
            Ver detalhes
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
  card: { backgroundColor: colors.surface, padding: spacing.md, gap: spacing.sm },
  x: { color: colors.text },
  link: { color: colors.primary },
  estado: { flex: 1 },
});
