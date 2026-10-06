import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/cliente';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/design-system/Button';
import { Campo } from '@/design-system/Campo';
import { colors, spacing } from '@/design-system/tokens';
import { useConsulta } from '@/hooks/useConsulta';

interface EmpresaResumo {
  id: string;
  statusVerificacao: string;
  registroDns: string;
  exigeRevisaoManual: boolean;
}

export default function VerificacaoScreen() {
  const { t } = useTranslation();
  const { sessao, accessToken } = useAuth();
  const empresaId = sessao?.empresaAtivaId ?? sessao?.empresas[0]?.empresaId ?? '';
  const [codigo, setCodigo] = useState('');
  const consulta = useConsulta(
    ['verificacao'],
    () => api<EmpresaResumo>(`/empresas/${empresaId}`, {}, accessToken),
    empresaId,
  );

  return (
    <View style={styles.tela}>
      <Text style={styles.titulo}>{t('empresa.status')}</Text>
      <Text style={styles.texto}>{consulta.data?.statusVerificacao}</Text>
      <Text style={styles.texto}>
        {t('empresa.dns')}: {consulta.data?.registroDns}
      </Text>
      <Campo label={t('empresa.codigoEmail')} value={codigo} onChangeText={setCodigo} autoCapitalize="none" />
      <Button
        label={t('empresa.confirmarEmail')}
        onPress={() =>
          void api(`/empresas/${empresaId}/verificacao/email`, {
            method: 'POST',
            body: JSON.stringify({ codigo }),
          }, accessToken).then(() => consulta.refetch())
        }
      />
      <Button
        label={t('empresa.confirmarDns')}
        onPress={() =>
          void api(`/empresas/${empresaId}/verificacao/dominio`, { method: 'POST' }, accessToken).then(() =>
            consulta.refetch(),
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, padding: spacing.lg, backgroundColor: colors.background },
  titulo: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  texto: { color: colors.text, marginBottom: spacing.sm },
});
