import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { api, ErroApi } from '@/api/cliente';
import { useAuth } from '@/auth/AuthContext';
import { Banner } from '@/design-system/Banner';
import { Button } from '@/design-system/Button';
import { Campo } from '@/design-system/Campo';
import { colors, spacing } from '@/design-system/tokens';
import { useConsulta } from '@/hooks/useConsulta';

interface ItemRanking {
  candidaturaId: string;
  scoreFinal: number | null;
  completude: number | null;
  explicacao: { texto?: string };
}

const CAMPOS = ['perfil', 'habilidades', 'curriculo', 'linkedin', 'triagem', 'voz'] as const;

export default function RankingScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { sessao, accessToken } = useAuth();
  const empresaId = sessao?.empresaAtivaId ?? sessao?.empresas[0]?.empresaId ?? '';
  const consulta = useConsulta(
    ['ranking', id ?? ''],
    () => api<{ itens: ItemRanking[] }>(`/empresas/${empresaId}/vagas/${id}/ranking`, {}, accessToken),
    empresaId,
  );
  const [pesos, setPesos] = useState<Record<string, string>>({
    perfil: '10',
    habilidades: '25',
    curriculo: '10',
    linkedin: '2',
    triagem: '23',
    voz: '30',
  });
  const [erro, setErro] = useState('');

  async function salvar() {
    setErro('');
    const corpo = Object.fromEntries(CAMPOS.map((chave) => [chave, Number(pesos[chave] ?? 0)]));
    try {
      await api(`/empresas/${empresaId}/vagas/${id}/ranking/pesos`, { method: 'PUT', body: JSON.stringify(corpo) }, accessToken);
      await consulta.refetch();
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : t('comum.erro'));
    }
  }

  const itens = consulta.data?.itens ?? [];
  return (
    <ScrollView style={styles.tela} contentContainerStyle={styles.conteudo}>
      <Text style={styles.titulo}>{t('ranking.titulo')}</Text>
      {erro ? <Banner tipo="erro" texto={erro} /> : null}
      {itens.length === 0 ? <Text style={styles.texto}>{t('ranking.vazio')}</Text> : null}
      {itens.map((item) => (
        <View key={item.candidaturaId} style={styles.bloco}>
          <Text style={styles.texto}>{Math.round(item.scoreFinal ?? 0)}/100</Text>
          <Text style={styles.texto}>
            {t('ranking.completude')}: {item.completude ?? 0}
          </Text>
          <Text style={styles.texto}>{item.explicacao?.texto ?? ''}</Text>
        </View>
      ))}
      <Text style={styles.texto}>{t('ranking.pesos')}</Text>
      {CAMPOS.map((chave) => (
        <Campo key={chave} label={chave} value={pesos[chave] ?? ''} onChangeText={(valor) => setPesos((atual) => ({ ...atual, [chave]: valor }))} />
      ))}
      <Button label={t('ranking.salvar')} onPress={() => void salvar()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  conteudo: { padding: spacing.lg, gap: spacing.md },
  titulo: { fontSize: 22, fontWeight: '700', color: colors.text },
  texto: { color: colors.text },
  bloco: { gap: spacing.sm },
});
