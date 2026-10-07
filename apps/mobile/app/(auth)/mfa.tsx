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

export default function MfaScreen() {
  const { t } = useTranslation();
  const { accessToken, entrar } = useAuth();
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
    const nova = await entrar(tokens);
    router.replace(rotaInicial(nova));
  }

  return (
    <Tela teclado>
      <Cabecalho titulo={t('auth.mfaTitulo')} voltar />
      <Button label={t('auth.mfaIniciar')} onPress={() => void iniciar()} />
      {uri ? <Banner tipo="aviso" texto={uri} /> : null}
      <Campo label={t('auth.codigo')} value={codigo} onChangeText={setCodigo} autoCapitalize="none" keyboardType="number-pad" />
      <Button label={t('auth.mfaConfirmar')} variante="secundario" onPress={() => void confirmar()} />
      <Button label={t('auth.mfaVerificar')} onPress={() => void verificar()} />
      {codigos.length > 0 ? <Banner tipo="aviso" texto={`${t('auth.codigosRecuperacao')} ${codigos.join(' ')}`} /> : null}
    </Tela>
  );
}
