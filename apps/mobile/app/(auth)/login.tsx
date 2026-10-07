import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '@/api/cliente';
import { rotaInicial } from '@/auth/acesso';
import { useAuth } from '@/auth/AuthContext';
import { Banner } from '@/design-system/Banner';
import { Button } from '@/design-system/Button';
import { Cabecalho } from '@/design-system/Cabecalho';
import { Campo } from '@/design-system/Campo';
import { Tela } from '@/design-system/Tela';

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
      <Cabecalho titulo={t('auth.loginTitulo')} subtitulo={t('home.subtitle')} voltar />
      <Campo label={t('auth.email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <Campo label={t('auth.senha')} value={senha} onChangeText={setSenha} secureTextEntry autoCapitalize="none" />
      {erro ? <Banner tipo="erro" texto={erro} /> : null}
      <Button label={t('home.entrar')} onPress={() => void enviar()} />
      <Button label={t('home.cadastrar')} variante="texto" onPress={() => router.push('/cadastro')} />
      <Button label={t('auth.recuperar')} variante="texto" onPress={() => router.push('/recuperar')} />
    </Tela>
  );
}
