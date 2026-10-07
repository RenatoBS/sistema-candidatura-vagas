import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '@/api/cliente';
import { Button } from '@/design-system/Button';
import { Cabecalho } from '@/design-system/Cabecalho';
import { Campo } from '@/design-system/Campo';
import { Tela } from '@/design-system/Tela';

export default function RedefinirScreen() {
  const { t } = useTranslation();
  const [token, setToken] = useState('');
  const [senha, setSenha] = useState('');

  return (
    <Tela teclado>
      <Cabecalho titulo={t('auth.redefinirTitulo')} voltar />
      <Campo label={t('auth.codigo')} value={token} onChangeText={setToken} autoCapitalize="none" />
      <Campo label={t('auth.senha')} value={senha} onChangeText={setSenha} secureTextEntry autoCapitalize="none" />
      <Button
        label={t('comum.salvar')}
        onPress={() => void api('/auth/redefinir', { method: 'POST', body: JSON.stringify({ token, senha }) })}
      />
    </Tela>
  );
}
