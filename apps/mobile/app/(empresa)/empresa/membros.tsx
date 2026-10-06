import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/cliente';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/design-system/Button';
import { Campo } from '@/design-system/Campo';
import { colors, spacing } from '@/design-system/tokens';
import { useConsulta } from '@/hooks/useConsulta';
import { usePermissao } from '@/hooks/usePermissao';

interface Membro {
  id: string;
  papeis: string[];
  status: string;
}

export default function MembrosScreen() {
  const { t } = useTranslation();
  const { sessao, accessToken } = useAuth();
  const empresaId = sessao?.empresaAtivaId ?? '';
  const pode = usePermissao('gerenciar_membros', empresaId);
  const [email, setEmail] = useState('');
  const consulta = useConsulta(
    ['membros'],
    () => api<Membro[]>(`/empresas/${empresaId}/membros`, {}, accessToken),
    empresaId,
  );

  async function convidar(papel: 'RECRUTADOR' | 'AVALIADOR') {
    await api(
      `/empresas/${empresaId}/membros/convites`,
      { method: 'POST', body: JSON.stringify({ email, papeis: [papel] }) },
      accessToken,
    );
    await consulta.refetch();
  }

  if (!pode) return <Text style={styles.texto}>{t('comum.erro')}</Text>;

  return (
    <View style={styles.tela}>
      <Text style={styles.titulo}>{t('empresa.membros')}</Text>
      {(consulta.data ?? []).map((membro) => (
        <Text key={membro.id} style={styles.texto}>
          {membro.papeis.join(', ')} · {membro.status}
        </Text>
      ))}
      <Campo label={t('auth.email')} value={email} onChangeText={setEmail} autoCapitalize="none" />
      <Button label={t('empresa.papelRecrutador')} onPress={() => void convidar('RECRUTADOR')} />
      <Button label={t('empresa.papelAvaliador')} onPress={() => void convidar('AVALIADOR')} />
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, padding: spacing.lg, backgroundColor: colors.background },
  titulo: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  texto: { color: colors.text, marginBottom: spacing.sm },
});
