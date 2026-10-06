import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/cliente';
import { Button } from '@/design-system/Button';
import { Campo } from '@/design-system/Campo';
import { colors, spacing } from '@/design-system/tokens';

export default function CadastroScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');

  async function enviar() {
    await api('/auth/cadastro', { method: 'POST', body: JSON.stringify({ email, senha }) });
    router.push('/confirmar-email');
  }

  return (
    <View style={styles.tela}>
      <Text style={styles.titulo}>{t('auth.cadastroTitulo')}</Text>
      <Campo label={t('auth.email')} value={email} onChangeText={setEmail} autoCapitalize="none" />
      <Campo label={t('auth.senha')} value={senha} onChangeText={setSenha} secureTextEntry autoCapitalize="none" />
      <Button label={t('comum.enviar')} onPress={() => void enviar()} />
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, padding: spacing.lg, backgroundColor: colors.background },
  titulo: { fontSize: 24, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
});
