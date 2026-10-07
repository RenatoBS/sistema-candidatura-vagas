import { useRouter } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '@/api/cliente';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/design-system/Button';
import { colors, spacing } from '@/design-system/tokens';
import { useConsulta } from '@/hooks/useConsulta';
import type { NotificacaoDto, NotificacoesResponse } from '@scv/contracts';

const ROTULOS: Record<string, string> = {
  CANDIDATO_NOVO: 'Novo candidato',
  MATCH_FORTE: 'Match forte',
  CONVITE_MATCH: 'Convite de match',
};
export default function Notificacoes() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const consulta = useConsulta<NotificacoesResponse>(['notificacoes'], () =>
    api<NotificacoesResponse>('/notificacoes', {}, accessToken),
  );
  async function marcar(id?: string) {
    await api(
      id ? `/notificacoes/${id}/lida` : '/notificacoes/lidas',
      { method: 'POST' },
      accessToken,
    );
    await consulta.refetch();
  }
  function abrir(item: NotificacaoDto) {
    void marcar(item.id);
    const dados = item.dados;
    const id = String(dados.vagaId ?? dados.candidaturaId ?? dados.sugestaoId ?? '');
    if (id)
      router.push(
        item.tipo === 'CANDIDATO_NOVO' ? `/candidato/candidaturas/${id}` : `/candidato/vagas/${id}`,
      );
  }
  if (consulta.isLoading)
    return <ActivityIndicator style={styles.carregando} color={colors.primary} />;
  if (consulta.isError)
    return (
      <View style={styles.estado}>
        <Text style={styles.texto}>Não foi possível carregar as notificações.</Text>
        <Button label="Tentar novamente" onPress={() => void consulta.refetch()} />
      </View>
    );
  const itens = consulta.data?.itens ?? [];
  return (
    <ScrollView style={styles.tela} contentContainerStyle={styles.conteudo}>
      <Text style={styles.titulo}>Central de notificações</Text>
      <Button label="Marcar todas como lidas" variante="secundario" onPress={() => void marcar()} />
      {itens.length === 0 ? (
        <Text style={styles.texto}>Você não tem notificações novas.</Text>
      ) : (
        itens.map((item) => (
          <View
            key={item.id}
            style={[styles.card, !item.lida && !item.lidaEm ? styles.naoLida : null]}
          >
            <Text style={styles.rotulo}>
              {item.resumo
                ? `${item.agrupadas} novos candidatos`
                : (ROTULOS[item.tipo] ?? 'Atualização')}
            </Text>
            <Text style={styles.texto}>
              {String(
                item.dados.vagaTitulo ??
                  (item.resumo
                    ? 'Novas movimentações na vaga.'
                    : 'Você recebeu uma nova atualização.'),
              )}
            </Text>
            {!item.lida && !item.lidaEm ? (
              <Button label="Marcar como lida" onPress={() => void marcar(item.id)} />
            ) : null}
            <Button label="Abrir" variante="secundario" onPress={() => abrir(item)} />
          </View>
        ))
      )}
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  conteudo: { padding: spacing.lg, gap: spacing.md },
  carregando: { flex: 1 },
  estado: { flex: 1, justifyContent: 'center', padding: spacing.lg, gap: spacing.md },
  titulo: { color: colors.text, fontSize: 22, fontWeight: '700' },
  card: { backgroundColor: colors.surface, padding: spacing.md, gap: spacing.sm },
  naoLida: { borderLeftColor: colors.primary, borderLeftWidth: 4 },
  rotulo: { color: colors.primary, fontWeight: '700' },
  texto: { color: colors.text },
});
