import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';

import { api } from '@/api/cliente';
import { useAuth } from '@/auth/AuthContext';
import { Banner } from '@/design-system/Banner';
import { Button } from '@/design-system/Button';
import { Cabecalho } from '@/design-system/Cabecalho';
import { Campo } from '@/design-system/Campo';
import { estilos } from '@/design-system/estilos';
import { Tela } from '@/design-system/Tela';

export default function DadosCandidato() {
  const { t } = useTranslation();
  const { accessToken } = useAuth();
  const [senha, setSenha] = useState('');
  const [pacote, setPacote] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState(false);

  async function exportar() {
    const dados = await api<unknown>('/lgpd/exportar', { method: 'POST' }, accessToken);
    setPacote(JSON.stringify(dados, null, 2));
    setMensagem('');
    setErro(false);
  }

  async function excluir() {
    try {
      const reauth = await api<{ reauthToken: string }>(
        '/auth/reautenticar',
        { method: 'POST', body: JSON.stringify({ senha }) },
        accessToken,
      );
      await api(
        '/lgpd/excluir',
        {
          method: 'POST',
          headers: { 'x-reauth-token': reauth.reauthToken },
          body: JSON.stringify({ confirmacao: 'EXCLUIR' }),
        },
        accessToken,
      );
      setErro(false);
      setMensagem(t('candidato.dadosExcluidos'));
      setPacote('');
    } catch {
      setErro(true);
      setMensagem(t('comum.erro'));
    }
  }

  return (
    <Tela teclado>
      <Cabecalho titulo={t('candidato.dados')} subtitulo={t('candidato.dadosAjuda')} voltar />
      <Button label={t('candidato.exportar')} onPress={() => void exportar()} />
      {pacote ? <Text style={estilos.legenda}>{pacote}</Text> : null}
      <Campo label={t('auth.senha')} value={senha} onChangeText={setSenha} secureTextEntry autoCapitalize="none" />
      <Button label={t('candidato.excluir')} variante="perigo" onPress={() => void excluir()} />
      {mensagem ? <Banner tipo={erro ? 'erro' : 'ok'} texto={mensagem} /> : null}
    </Tela>
  );
}
