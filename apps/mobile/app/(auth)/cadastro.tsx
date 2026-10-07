import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '@/api/cliente';
import { Button } from '@/design-system/Button';
import { Cabecalho } from '@/design-system/Cabecalho';
import { Campo } from '@/design-system/Campo';
import { Tela } from '@/design-system/Tela';

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
      <Cabecalho titulo={t('auth.cadastroTitulo')} voltar />
      <Campo label={t('auth.email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <Campo label={t('auth.senha')} value={senha} onChangeText={setSenha} secureTextEntry autoCapitalize="none" />
      <Button label={t('comum.enviar')} onPress={() => void enviar()} />
      <Button label={t('home.entrar')} variante="texto" onPress={() => router.push('/login')} />
    </Tela>
  );
}
