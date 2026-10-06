import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/cliente';
import { Button } from '@/design-system/Button';
import { Campo } from '@/design-system/Campo';
import { colors, spacing } from '@/design-system/tokens';

export default function ConfirmarEmailScreen() {
  const { t } = useTranslation();
  const [token, setToken] = useState('');
  const [ok, setOk] = useState(false);

  async function enviar() {
    await api('/auth/confirmar-email', { method: 'POST', body: JSON.stringify({ token }) });
    setOk(true);
  }

  return (
    <View style={styles.tela}>
      <Text style={styles.titulo}>{t('auth.confirmarEmail')}</Text>
      <Campo label={t('auth.codigo')} value={token} onChangeText={setToken} autoCapitalize="none" />
      <Button label={t('comum.enviar')} onPress={() => void enviar()} />
      {ok ? <Text style={styles.ok}>{t('auth.confirmarEmail')}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, padding: spacing.lg, backgroundColor: colors.background },
  titulo: { fontSize: 24, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  ok: { color: colors.success, marginTop: spacing.md },
});
