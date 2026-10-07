import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { api } from '@/api/cliente';
import { useAuth } from '@/auth/AuthContext';
import { rotuloStatus } from '@/candidatura/regras';
import { colors, spacing } from '@/design-system/tokens';
import { useConsulta } from '@/hooks/useConsulta';
export default function Detalhe() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { accessToken } = useAuth();
  const q = useConsulta<{
    vaga?: { titulo: string };
    status?: string;
    fase?: string;
    rotuloAmigavel?: string;
  }>(['candidatura', id ?? ''], () => api(`/candidatos/me/candidaturas/${id}`, {}, accessToken));
  return (
    <View style={s.t}>
      <Text style={s.h}>{q.data?.vaga?.titulo ?? 'Candidatura'}</Text>
      <Text style={s.x}>
        {q.data?.rotuloAmigavel ?? rotuloStatus(q.data?.status, q.data?.fase)}
      </Text>
    </View>
  );
}
const s = StyleSheet.create({
  t: { flex: 1, padding: spacing.lg, backgroundColor: colors.background, gap: spacing.md },
  h: { fontSize: 22, fontWeight: '700', color: colors.text },
  x: { color: colors.text },
});
