import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '@/api/cliente';
import { useAuth } from '@/auth/AuthContext';
import { colors, spacing } from '@/design-system/tokens';
import { useConsulta } from '@/hooks/useConsulta';
interface CandidatoVaga {
  id: string;
  candidato?: { nome?: string; primeiroNome?: string };
  status?: string;
  origem?: string;
}
export default function CandidatosDaVaga() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { accessToken, sessao } = useAuth();
  const empresaId = sessao?.empresaAtivaId ?? sessao?.empresas[0]?.empresaId ?? '';
  const consulta = useConsulta<CandidatoVaga[]>(['candidatos-vaga', id ?? ''], () =>
    api<CandidatoVaga[]>(`/vagas/${id}/candidaturas`, { headers: { 'x-empresa-id': empresaId } }, accessToken),
  );
  if (consulta.isLoading) return <ActivityIndicator style={styles.estado} color={colors.primary} />;
  if (consulta.isError)
    return <Text style={styles.texto}>Não foi possível carregar os candidatos.</Text>;
  return (
    <ScrollView style={styles.tela} contentContainerStyle={styles.conteudo}>
      <Text style={styles.titulo}>Candidatos da vaga</Text>
      {(consulta.data ?? []).length === 0 ? (
        <Text style={styles.texto}>Ainda não há candidatos para esta vaga.</Text>
      ) : (
        (consulta.data ?? []).map((candidato) => (
          <View style={styles.card} key={candidato.id}>
            <Text style={styles.nome}>
              {candidato.candidato?.nome ?? candidato.candidato?.primeiroNome ?? 'Candidato'}
            </Text>
            <Text style={styles.texto}>Status: {candidato.status ?? 'Em análise'}</Text>
            <Text style={styles.texto}>Origem: {candidato.origem ?? 'Candidatura direta'}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  conteudo: { padding: spacing.lg, gap: spacing.md },
  estado: { flex: 1 },
  titulo: { color: colors.text, fontSize: 22, fontWeight: '700' },
  card: { backgroundColor: colors.surface, padding: spacing.md, gap: spacing.sm },
  nome: { color: colors.text, fontSize: 17, fontWeight: '700' },
  texto: { color: colors.text },
});
