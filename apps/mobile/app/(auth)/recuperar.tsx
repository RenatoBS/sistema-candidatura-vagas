import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '@/api/cliente';
import { Banner } from '@/design-system/Banner';
import { Button } from '@/design-system/Button';
import { Cabecalho } from '@/design-system/Cabecalho';
import { Campo } from '@/design-system/Campo';
import { Tela } from '@/design-system/Tela';

export default function RecuperarScreen() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [enviado, setEnviado] = useState(false);

  async function enviar() {
    await api('/auth/recuperar', { method: 'POST', body: JSON.stringify({ email }) });
    setEnviado(true);
  }

  return (
    <Tela teclado>
      <Cabecalho titulo={t('auth.recuperar')} voltar />
      <Campo label={t('auth.email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <Button label={t('comum.enviar')} onPress={() => void enviar()} />
      {enviado ? <Banner tipo="ok" texto={t('auth.redefinirTitulo')} /> : null}
    </Tela>
  );
}
