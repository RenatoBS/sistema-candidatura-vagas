import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/cliente';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/design-system/Button';
import { Campo } from '@/design-system/Campo';
import { colors, spacing } from '@/design-system/tokens';

export default function LoginScreen() {
  const { t } = useTranslation();
  const { entrar } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');

  async function enviar() {
    try {
      const tokens = await api<{ accessToken: string; refreshToken: string; mfaObrigatorio: boolean }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, senha }),
      });
      await entrar(tokens);
      router.replace(tokens.mfaObrigatorio ? '/mfa' : '/onboarding');
    } catch {
      setErro(t('comum.erro'));
    }
  }

  return (
    <View style={styles.tela}>
      <Text style={styles.titulo}>{t('auth.loginTitulo')}</Text>
      <Campo label={t('auth.email')} value={email} onChangeText={setEmail} autoCapitalize="none" />
      <Campo label={t('auth.senha')} value={senha} onChangeText={setSenha} secureTextEntry autoCapitalize="none" />
      {erro ? <Text style={styles.erro}>{erro}</Text> : null}
      <Button label={t('home.entrar')} onPress={() => void enviar()} />
      <Link href="/cadastro">{t('home.cadastrar')}</Link>
      <Link href="/recuperar">{t('auth.recuperar')}</Link>
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, padding: spacing.lg, backgroundColor: colors.background, gap: spacing.sm },
  titulo: { fontSize: 24, fontWeight: '700', color: colors.text },
  erro: { color: colors.danger },
});
