import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/cliente';
import { Button } from '@/design-system/Button';
import { Campo } from '@/design-system/Campo';
import { colors, spacing } from '@/design-system/tokens';

export default function RecuperarScreen() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [enviado, setEnviado] = useState(false);

  async function enviar() {
    await api('/auth/recuperar', { method: 'POST', body: JSON.stringify({ email }) });
    setEnviado(true);
  }

  return (
    <View style={styles.tela}>
      <Text style={styles.titulo}>{t('auth.recuperar')}</Text>
      <Campo label={t('auth.email')} value={email} onChangeText={setEmail} autoCapitalize="none" />
      <Button label={t('comum.enviar')} onPress={() => void enviar()} />
      {enviado ? <Text style={styles.ok}>{t('auth.redefinirTitulo')}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, padding: spacing.lg, backgroundColor: colors.background },
  titulo: { fontSize: 24, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  ok: { color: colors.success, marginTop: spacing.md },
});
