import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '@/api/cliente';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/design-system/Button';
import { colors, spacing } from '@/design-system/tokens';
import { useConsulta } from '@/hooks/useConsulta';
type Convite = {
  id: string;
  vaga?: { id: string; titulo: string };
  status?: string;
  expiraEm?: string;
};
const consentimentos = [{ tipo: 'TERMOS', concedido: true, versaoTermo: '2026-10-06' }];
export default function Convites() {
  const { accessToken } = useAuth();
  const [erro, setErro] = useState('');
  const q = useConsulta<{ convites: Convite[] }>(['convites'], () =>
    api<{ convites: Convite[] }>('/candidatos/me/convites', {}, accessToken),
  );
  async function agir(id: string, acao: 'aceitar' | 'recusar') {
    try {
      await api(
        `/candidatos/me/convites/${id}/${acao}`,
        {
          method: 'POST',
          body: acao === 'aceitar' ? JSON.stringify({ consentimentos }) : undefined,
        },
        accessToken,
      );
      await q.refetch();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível concluir.');
    }
  }
  if (q.isLoading) return <ActivityIndicator style={s.estado} color={colors.primary} />;
  if (q.isError) return <Text style={s.erro}>Não foi possível carregar os convites.</Text>;
  return (
    <ScrollView style={s.tela} contentContainerStyle={s.conteudo}>
      <Text style={s.titulo}>Convites de match</Text>
      {erro ? <Text style={s.erro}>{erro}</Text> : null}
      {(q.data?.convites ?? []).length === 0 ? (
        <Text style={s.texto}>Você não tem convites pendentes.</Text>
      ) : null}
      {(q.data?.convites ?? []).map((c) => (
        <View style={s.card} key={c.id}>
          <Text style={s.texto}>{c.vaga?.titulo ?? 'Vaga'}</Text>
          <Text style={s.texto}>{c.status ?? 'PENDENTE'}</Text>
          <Button
            label="Aceitar"
            onPress={() =>
              Alert.alert(
                'Aceitar convite',
                'Ao aceitar, você concorda com os termos da candidatura.',
                [
                  { text: 'Cancelar', style: 'cancel' },
                  { text: 'Aceitar', onPress: () => void agir(c.id, 'aceitar') },
                ],
              )
            }
          />
          <Button
            label="Recusar"
            variante="secundario"
            onPress={() =>
              Alert.alert('Recusar convite', 'Deseja recusar este convite?', [
                { text: 'Cancelar', style: 'cancel' },
                {
                  text: 'Recusar',
                  style: 'destructive',
                  onPress: () => void agir(c.id, 'recusar'),
                },
              ])
            }
          />
        </View>
      ))}
    </ScrollView>
  );
}
const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  conteudo: { padding: spacing.lg, gap: spacing.md },
  titulo: { fontSize: 22, fontWeight: '700', color: colors.text },
  card: { backgroundColor: colors.surface, padding: spacing.md, gap: spacing.sm },
  texto: { color: colors.text },
  erro: { color: colors.danger },
  estado: { flex: 1 },
});
