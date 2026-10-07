import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/cliente';
import { ErroApi } from '@/api/cliente';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/design-system/Button';
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
  const { accessToken } = useAuth();
  const [mensagem, setMensagem] = useState('');
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
      {mensagem ? <Text style={styles.texto}>{mensagem}</Text> : null}
      <Button label="Candidatar-se" onPress={() => void (async () => { try { await api(`/vagas-publicas/${id}/candidaturas`, { method: 'POST', body: JSON.stringify({ consentimentos: [{ tipo: 'TERMOS', concedido: true, versaoTermo: '2026-10-06' }] }) }, accessToken); setMensagem('Candidatura enviada.'); } catch (e) { setMensagem(e instanceof ErroApi && e.status === 409 ? 'Você já se candidatou ou o prazo encerrou.' : 'Não foi possível candidatar-se.'); } })()} />
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, padding: spacing.lg, backgroundColor: colors.background, gap: spacing.sm },
  titulo: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  texto: { color: colors.text },
});
