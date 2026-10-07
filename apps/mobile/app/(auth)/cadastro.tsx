import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/cliente';
import { Button } from '@/design-system/Button';
import { Cabecalho } from '@/design-system/Cabecalho';
import { Campo } from '@/design-system/Campo';
import { Marca } from '@/design-system/Marca';
import { Tela } from '@/design-system/Tela';
import { colors, spacing, tipo } from '@/design-system/tokens';

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
    <Tela teclado>
      <Marca compacta />
      <View style={styles.apresentacao}><Cabecalho titulo={t('auth.cadastroTitulo')} subtitulo="Crie seu acesso e encontre oportunidades que fazem sentido para você." voltar /></View>
      <View style={styles.formulario}>
        <Campo label={t('auth.email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <Campo label={t('auth.senha')} value={senha} onChangeText={setSenha} secureTextEntry autoCapitalize="none" />
        <Button label={t('comum.continuar')} onPress={() => void enviar()} />
      </View>
      <View style={styles.rodape}>
        <Text style={styles.conta}>Já possui uma conta?</Text>
        <Text style={styles.link} onPress={() => router.push('/login')}>{t('home.entrar')}</Text>
      </View>
    </Tela>
  );
}

const styles = StyleSheet.create({
  apresentacao: { marginTop: spacing.md },
  formulario: { gap: spacing.md, marginTop: spacing.sm },
  rodape: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: spacing.sm },
  conta: { ...tipo.legenda, color: colors.textMuted },
  link: { ...tipo.legenda, color: colors.primary },
});
