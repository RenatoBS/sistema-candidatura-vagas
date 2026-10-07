import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api, ErroApi } from '@/api/cliente';
import { useAuth } from '@/auth/AuthContext';
import { TrocaVisao } from '@/componentes/TrocaVisao';
import { Banner } from '@/design-system/Banner';
import { Button } from '@/design-system/Button';
import { Cabecalho } from '@/design-system/Cabecalho';
import { Campo } from '@/design-system/Campo';
import { Tela } from '@/design-system/Tela';

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const { accessToken, entrar } = useAuth();
  const router = useRouter();
  const [nome, setNome] = useState('');
  const [erro, setErro] = useState('');

  async function candidato() {
    setErro('');
    if (nome.trim().length < 2) {
      setErro(t('onboarding.nomeObrigatorio'));
      return;
    }
    try {
      const tokens = await api<{ accessToken: string; refreshToken: string }>(
        '/onboarding/candidato',
        { method: 'POST', body: JSON.stringify({ nome: nome.trim() }) },
        accessToken,
      );
      await entrar(tokens);
      router.replace('/candidato');
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : t('comum.erro'));
    }
  }

  return (
    <Tela teclado>
      <Cabecalho titulo={t('onboarding.titulo')} />
      {erro ? <Banner tipo="erro" texto={erro} /> : null}
      <Campo label={t('onboarding.nome')} value={nome} onChangeText={setNome} />
      <Button label={t('onboarding.candidato')} onPress={() => void candidato()} />
      <Button label={t('onboarding.empresa')} variante="secundario" onPress={() => router.push('/onboarding/empresa')} />
      <TrocaVisao />
    </Tela>
  );
}
