import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '@/api/cliente';
import { useAuth } from '@/auth/AuthContext';
import { rotuloNotificacao } from '@/candidatura/regras';
import { Button } from '@/design-system/Button';
import { colors, spacing } from '@/design-system/tokens';
import { useConsulta } from '@/hooks/useConsulta';

type N = { id: string; tipo: string; titulo?: string; mensagem?: string; lida?: boolean; lidoEm?: string | null; entidadeId?: string };
export default function Notificacoes() { const { accessToken } = useAuth(); const router = useRouter(); const [erro, setErro] = useState('');
  const q = useConsulta<N[]>(['notificacoes'], () => api<N[]>('/notificacoes', {}, accessToken));
  async function lida(id?: string) { try { await api(id ? `/notificacoes/${id}/lida` : '/notificacoes/lidas', { method: 'POST' }, accessToken); await q.refetch(); } catch { setErro('Não foi possível atualizar as notificações.'); } }
  return <ScrollView style={s.tela} contentContainerStyle={s.conteudo}><Text style={s.titulo}>Notificações</Text><Button label="Marcar todas como lidas" variante="secundario" onPress={() => void lida()} />{erro ? <Text style={s.erro}>{erro}</Text> : null}{(q.data ?? []).map((n) => <View key={n.id} style={[s.card, !n.lida && !n.lidoEm ? s.naoLida : null]}><Text style={s.rotulo}>{rotuloNotificacao(n.tipo)}</Text><Text style={s.texto}>{n.titulo ?? n.mensagem ?? 'Nova atualização'}</Text>{!n.lida && !n.lidoEm ? <Button label="Marcar lida" onPress={() => void lida(n.id)} /> : null}<Button label="Abrir" variante="secundario" onPress={() => { void lida(n.id); if (n.entidadeId) router.push(`/candidato/vagas/${n.entidadeId}`); }} /></View>)}</ScrollView>; }
const s = StyleSheet.create({ tela:{flex:1,backgroundColor:colors.background},conteudo:{padding:spacing.lg,gap:spacing.md},titulo:{fontSize:22,fontWeight:'700',color:colors.text},card:{padding:spacing.md,backgroundColor:colors.surface,borderRadius:8,gap:spacing.sm},naoLida:{borderLeftWidth:4,borderLeftColor:colors.primary},rotulo:{fontWeight:'700',color:colors.primary},texto:{color:colors.text},erro:{color:colors.danger} });
