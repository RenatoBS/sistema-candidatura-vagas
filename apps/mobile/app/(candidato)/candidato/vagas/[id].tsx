import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/cliente';
import { colors, spacing } from '@/design-system/tokens';
import { useConsulta } from '@/hooks/useConsulta';

interface VagaPublica {
  titulo: string;
  descricao: string;
  senioridade: string;
  modelo: string;
  localidade: string | null;
  prazoInscricoesBrasilia: string | null;
  habilidades: Array<{ nome: string; nivelMinimo: number }>;
}

export default function DetalheVagaCandidatoScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const vaga = useConsulta(['vaga-publica', id ?? ''], () => api<VagaPublica>(`/vagas-publicas/${id}`), null);
  const dados = vaga.data;

  return (
    <View style={styles.tela}>
      <Text style={styles.titulo}>{dados?.titulo ?? t('vaga.detalhe')}</Text>
      <Text style={styles.texto}>{dados?.descricao}</Text>
      <Text style={styles.texto}>
        {dados?.senioridade} · {dados?.modelo}
        {dados?.localidade ? ` · ${dados.localidade}` : ''}
      </Text>
      <Text style={styles.texto}>
        {t('vaga.ate')}: {dados?.prazoInscricoesBrasilia ?? '—'}
      </Text>
      {(dados?.habilidades ?? []).map((habilidade) => (
        <Text key={habilidade.nome} style={styles.texto}>
          {habilidade.nome} · {t('vaga.nivel')} {habilidade.nivelMinimo}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, padding: spacing.lg, backgroundColor: colors.background, gap: spacing.sm },
  titulo: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  texto: { color: colors.text },
});