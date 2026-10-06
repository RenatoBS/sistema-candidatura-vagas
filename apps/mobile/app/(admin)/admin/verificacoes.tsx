import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/cliente';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/design-system/Button';
import { Campo } from '@/design-system/Campo';
import { colors, spacing } from '@/design-system/tokens';
import { useConsulta } from '@/hooks/useConsulta';

interface ItemFila {
  id: string;
  nomeFantasia: string;
  statusVerificacao: string;
}

export default function FilaVerificacaoScreen() {
  const { t } = useTranslation();
  const { accessToken } = useAuth();
  const [motivo, setMotivo] = useState('');
  const consulta = useConsulta(['fila'], () => api<ItemFila[]>('/admin/empresas/fila', {}, accessToken), null);

  async function acao(id: string, caminho: 'aprovar' | 'rejeitar' | 'suspender') {
    const reauth = await api<{ reauthToken: string }>(
      '/auth/reautenticar',
      { method: 'POST', body: JSON.stringify({ senha: motivo }) },
      accessToken,
    );
    await api(`/admin/empresas/${id}/${caminho}`, {
      method: 'POST',
      body: JSON.stringify({ motivo: motivo || 'revisao' }),
      headers: { authorization: `Bearer ${accessToken}`, 'x-reauth-token': reauth.reauthToken },
    });
    await consulta.refetch();
  }

  return (
    <View style={styles.tela}>
      <Text style={styles.titulo}>{t('admin.fila')}</Text>
      <Campo label={t('admin.motivo')} value={motivo} onChangeText={setMotivo} />
      {(consulta.data ?? []).length === 0 ? <Text style={styles.texto}>{t('admin.vazia')}</Text> : null}
      {(consulta.data ?? []).map((item) => (
        <View key={item.id} style={styles.item}>
          <Text style={styles.texto}>
            {item.nomeFantasia} · {item.statusVerificacao}
          </Text>
          <Button label={t('admin.aprovar')} onPress={() => void acao(item.id, 'aprovar')} />
          <Button label={t('admin.rejeitar')} onPress={() => void acao(item.id, 'rejeitar')} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, padding: spacing.lg, backgroundColor: colors.background },
  titulo: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  texto: { color: colors.text, marginBottom: spacing.sm },
  item: { marginBottom: spacing.md },
});
