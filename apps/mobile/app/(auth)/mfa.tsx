import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/cliente';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/design-system/Button';
import { Campo } from '@/design-system/Campo';
import { colors, spacing } from '@/design-system/tokens';

export default function MfaScreen() {
  const { t } = useTranslation();
  const { accessToken, entrar, sessao } = useAuth();
  const router = useRouter();
  const [uri, setUri] = useState('');
  const [codigo, setCodigo] = useState('');
  const [codigos, setCodigos] = useState<string[]>([]);

  async function iniciar() {
    const resposta = await api<{ otpauthUrl: string }>('/auth/mfa/iniciar', { method: 'POST' }, accessToken);
    setUri(resposta.otpauthUrl);
  }

  async function confirmar() {
    const resposta = await api<{ codigosRecuperacao: string[] }>(
      '/auth/mfa/confirmar',
      { method: 'POST', body: JSON.stringify({ codigo }) },
      accessToken,
    );
    setCodigos(resposta.codigosRecuperacao);
  }

  async function verificar() {
    const tokens = await api<{ accessToken: string; refreshToken: string }>(
      '/auth/mfa/verificar',
      { method: 'POST', body: JSON.stringify({ codigo }) },
      accessToken,
    );
    await entrar(tokens);
    if (sessao?.papeisGlobais.includes('ADMIN_PLATAFORMA')) router.replace('/admin');
    else router.replace('/onboarding');
  }

  return (
    <View style={styles.tela}>
      <Text style={styles.titulo}>{t('auth.mfaTitulo')}</Text>
      <Button label={t('auth.mfaIniciar')} onPress={() => void iniciar()} />
      {uri ? <Text style={styles.uri}>{uri}</Text> : null}
      <Campo label={t('auth.codigo')} value={codigo} onChangeText={setCodigo} autoCapitalize="none" />
      <Button label={t('auth.mfaConfirmar')} onPress={() => void confirmar()} />
      <Button label={t('auth.mfaVerificar')} onPress={() => void verificar()} />
      {codigos.length > 0 ? (
        <Text style={styles.uri}>
          {t('auth.codigosRecuperacao')} {codigos.join(' ')}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, padding: spacing.lg, backgroundColor: colors.background },
  titulo: { fontSize: 24, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  uri: { color: colors.textMuted, marginVertical: spacing.sm },
});
