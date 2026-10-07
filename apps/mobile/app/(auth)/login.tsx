import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/cliente';
import { rotaInicial } from '@/auth/acesso';
import { useAuth } from '@/auth/AuthContext';
import { Banner } from '@/design-system/Banner';
import { Button } from '@/design-system/Button';
import { Cabecalho } from '@/design-system/Cabecalho';
import { Campo } from '@/design-system/Campo';
import { Marca } from '@/design-system/Marca';
import { Tela } from '@/design-system/Tela';
import { colors, spacing, tipo } from '@/design-system/tokens';

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
      const sessao = await entrar(tokens);
      router.replace(tokens.mfaObrigatorio ? '/mfa' : rotaInicial(sessao));
    } catch {
      setErro(t('comum.erro'));
    }
  }

  return (
    <Tela teclado>
      <Marca compacta />
      <View style={styles.apresentacao}>
        <Cabecalho titulo={t('auth.loginTitulo')} subtitulo="Bom ter você de volta. Acesse sua jornada em poucos passos." voltar />
      </View>
      <View style={styles.formulario}>
        <Campo label={t('auth.email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <Campo label={t('auth.senha')} value={senha} onChangeText={setSenha} secureTextEntry autoCapitalize="none" />
        <View style={styles.linkEsqueceu}>
          <Pressable accessibilityRole="link" hitSlop={12} onPress={() => router.push('/recuperar')}>
            <Text style={styles.link}>{t('auth.recuperar')}</Text>
          </Pressable>
        </View>
        {erro ? <Banner tipo="erro" texto={erro} /> : null}
        <Button label={t('home.entrar')} onPress={() => void enviar()} />
      </View>
      <View style={styles.rodape}>
        <Text style={styles.conta}>Ainda não tem uma conta?</Text>
        <Pressable accessibilityRole="link" hitSlop={12} onPress={() => router.push('/cadastro')}>
          <Text style={styles.link}>{t('home.cadastrar')}</Text>
        </Pressable>
      </View>
    </Tela>
  );
}

const styles = StyleSheet.create({
  apresentacao: { marginTop: spacing.md },
  formulario: { gap: spacing.md, marginTop: spacing.sm },
  linkEsqueceu: { alignItems: 'flex-end', marginTop: -4 },
  link: { ...tipo.legenda, color: colors.primary },
  rodape: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: spacing.sm, paddingBottom: spacing.md },
  conta: { ...tipo.legenda, color: colors.textMuted },
});
