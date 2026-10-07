import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';

import { api } from '@/api/cliente';
import { useAuth } from '@/auth/AuthContext';
import { TrocaVisao } from '@/componentes/TrocaVisao';
import { Button } from '@/design-system/Button';
import { Cabecalho } from '@/design-system/Cabecalho';
import { Campo } from '@/design-system/Campo';
import { estilos } from '@/design-system/estilos';
import { Tela } from '@/design-system/Tela';

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const { accessToken, entrar } = useAuth();
  const router = useRouter();
  const [nome, setNome] = useState('');

  async function candidato() {
    const tokens = await api<{ accessToken: string; refreshToken: string }>(
      '/onboarding/candidato',
      { method: 'POST', body: JSON.stringify({ nome }) },
      accessToken,
    );
    await entrar(tokens);
    router.replace('/candidato');
  }

  return (
    <Tela teclado>
      <Cabecalho titulo={t('onboarding.titulo')} />
      <Campo label={t('onboarding.nome')} value={nome} onChangeText={setNome} />
      <Button label={t('onboarding.candidato')} onPress={() => void candidato()} />
      <Button label={t('onboarding.empresa')} variante="secundario" onPress={() => router.push('/onboarding/empresa')} />
      <Text style={estilos.legenda}>{t('visao.trocar')}</Text>
      <TrocaVisao />
    </Tela>
  );
}
