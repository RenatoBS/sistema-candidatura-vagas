import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { api } from '@/api/cliente';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/design-system/Button';
import { Campo } from '@/design-system/Campo';
import { colors, spacing } from '@/design-system/tokens';

export default function DadosCandidato() {
  const { t } = useTranslation();
  const { accessToken } = useAuth();
  const [senha, setSenha] = useState('');
  const [pacote, setPacote] = useState('');
  const [mensagem, setMensagem] = useState('');

  async function exportar() {
    const dados = await api<unknown>('/lgpd/exportar', { method: 'POST' }, accessToken);
    setPacote(JSON.stringify(dados, null, 2));
    setMensagem('');
  }

  async function excluir() {
    try {
      const reauth = await api<{ reauthToken: string }>(
        '/auth/reautenticar',
        { method: 'POST', body: JSON.stringify({ senha }) },
        accessToken,
      );
      await api('/lgpd/excluir', {
        method: 'POST',
        headers: { 'x-reauth-token': reauth.reauthToken },
        body: JSON.stringify({ confirmacao: 'EXCLUIR' }),
      }, accessToken);
      setMensagem(t('candidato.dadosExcluidos'));
      setPacote('');
    } catch {
      setMensagem(t('comum.erro'));
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.tela}>
      <Text style={styles.titulo}>{t('candidato.dados')}</Text>
      <Text style={styles.texto}>{t('candidato.dadosAjuda')}</Text>
      <Button label={t('candidato.exportar')} onPress={() => void exportar()} />
      {pacote ? <Text style={styles.pacote}>{pacote}</Text> : null}
      <Campo label={t('auth.senha')} value={senha} onChangeText={setSenha} secureTextEntry autoCapitalize="none" />
      <Button label={t('candidato.excluir')} onPress={() => void excluir()} />
      {mensagem ? <Text style={styles.texto}>{mensagem}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  tela: { padding: spacing.lg, backgroundColor: colors.background, gap: spacing.sm },
  titulo: { fontSize: 22, fontWeight: '700', color: colors.text },
  texto: { color: colors.text },
  pacote: { color: colors.textMuted, fontSize: 12 },
});
