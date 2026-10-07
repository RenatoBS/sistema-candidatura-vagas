import type { SugestoesMatchVagaResponse } from '@scv/contracts';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api, ErroApi } from '@/api/cliente';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/design-system/Button';
import { colors, spacing } from '@/design-system/tokens';
import { useConsulta } from '@/hooks/useConsulta';
export default function SugestoesDaVaga() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { accessToken } = useAuth();
  const [erro, setErro] = useState('');
  const consulta = useConsulta<SugestoesMatchVagaResponse>(['sugestoes-match', id ?? ''], () =>
    api<SugestoesMatchVagaResponse>(`/vagas/${id}/sugestoes-match`, {}, accessToken),
  );
  async function convidar(sugestaoId: string) {
    setErro('');
    try {
      await api(
        `/vagas/${id}/sugestoes-match/${sugestaoId}/convidar`,
        { method: 'POST' },
        accessToken,
      );
      await consulta.refetch();
    } catch (error) {
      setErro(
        error instanceof ErroApi && error.status === 409
          ? 'Este candidato já foi convidado.'
          : 'Não foi possível enviar o convite.',
      );
    }
  }
  if (consulta.isLoading) return <ActivityIndicator style={styles.estado} color={colors.primary} />;
  if (consulta.isError)
    return <Text style={styles.texto}>Não foi possível carregar as sugestões.</Text>;
  const itens = consulta.data?.sugestoes ?? [];
  return (
    <ScrollView style={styles.tela} contentContainerStyle={styles.conteudo}>
      <Text style={styles.titulo}>Sugestões de match</Text>
      {erro ? <Text style={styles.erro}>{erro}</Text> : null}
      {itens.length === 0 ? (
        <Text style={styles.texto}>Nenhuma sugestão disponível no momento.</Text>
      ) : (
        itens.map((item) => (
          <View style={styles.card} key={item.id}>
            <Text style={styles.nome}>{item.candidato.primeiroNome}</Text>
            <Text style={styles.compatibilidade}>
              {Math.round(item.compatibilidade * 100)}% de compatibilidade
            </Text>
            <Text style={styles.texto}>
              Habilidades em comum: {item.explicacao.atendidas.join(', ') || 'Nenhuma informada.'}
            </Text>
            <Text style={styles.texto}>
              Ainda precisa desenvolver:{' '}
              {item.explicacao.faltantes.join(', ') || 'Nenhuma apontada.'}
            </Text>
            {item.status === 'CONVIDADA' || item.status === 'ACEITA' ? (
              <Text style={styles.texto}>Convite enviado</Text>
            ) : (
              <Button label="Convidar" onPress={() => void convidar(item.id)} />
            )}
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
  compatibilidade: { color: colors.primary, fontWeight: '700' },
  texto: { color: colors.text },
  erro: { color: colors.danger },
});
