import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '@/api/cliente';
import { Banner } from '@/design-system/Banner';
import { Button } from '@/design-system/Button';
import { Cabecalho } from '@/design-system/Cabecalho';
import { Campo } from '@/design-system/Campo';
import { Tela } from '@/design-system/Tela';

export default function ConfirmarEmailScreen() {
  const { t } = useTranslation();
  const [token, setToken] = useState('');
  const [ok, setOk] = useState(false);

  async function enviar() {
    await api('/auth/confirmar-email', { method: 'POST', body: JSON.stringify({ token }) });
    setOk(true);
  }

  return (
    <Tela teclado>
      <Cabecalho titulo={t('auth.confirmarEmail')} voltar />
      <Campo label={t('auth.codigo')} value={token} onChangeText={setToken} autoCapitalize="none" />
      <Button label={t('comum.enviar')} onPress={() => void enviar()} />
      {ok ? <Banner tipo="ok" texto={t('auth.confirmarEmail')} /> : null}
    </Tela>
  );
}
