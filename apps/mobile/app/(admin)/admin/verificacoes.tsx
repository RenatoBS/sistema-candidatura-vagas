import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';

import { api } from '@/api/cliente';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/design-system/Button';
import { Cabecalho } from '@/design-system/Cabecalho';
import { Campo } from '@/design-system/Campo';
import { Cartao } from '@/design-system/Cartao';
import { EstadoVazio } from '@/design-system/EstadoVazio';
import { estilos } from '@/design-system/estilos';
import { Tela } from '@/design-system/Tela';
import { useConsulta } from '@/hooks/useConsulta';

interface ItemFila {
  id: string;
  nomeFantasia: string;
  statusVerificacao: string;
}

export default function FilaVerificacaoScreen() {
  const { t } = useTranslation();
  const { accessToken } = useAuth();
  const [motivo, setMotivo] = useState('');
  const consulta = useConsulta(['fila'], () => api<ItemFila[]>('/admin/empresas/fila', {}, accessToken), null);
  const itens = consulta.data ?? [];

  async function acao(id: string, caminho: 'aprovar' | 'rejeitar' | 'suspender') {
    const reauth = await api<{ reauthToken: string }>(
      '/auth/reautenticar',
      { method: 'POST', body: JSON.stringify({ senha: motivo }) },
      accessToken,
    );
    await api(`/admin/empresas/${id}/${caminho}`, {
      method: 'POST',
      body: JSON.stringify({ motivo: motivo || 'revisao' }),
      headers: { authorization: `Bearer ${accessToken}`, 'x-reauth-token': reauth.reauthToken },
    });
    await consulta.refetch();
  }

  return (
    <Tela teclado>
      <Cabecalho titulo={t('admin.fila')} voltar />
      <Campo label={t('admin.motivo')} value={motivo} onChangeText={setMotivo} />
      {consulta.isLoading ? <EstadoVazio titulo={t('comum.carregando')} /> : null}
      {!consulta.isLoading && itens.length === 0 ? <EstadoVazio titulo={t('admin.vazia')} /> : null}
      {itens.map((item) => (
        <Cartao key={item.id}>
          <Text style={estilos.tituloItem}>{item.nomeFantasia}</Text>
          <Text style={estilos.mudo}>{item.statusVerificacao}</Text>
          <Button label={t('admin.aprovar')} onPress={() => void acao(item.id, 'aprovar')} />
          <Button label={t('admin.rejeitar')} variante="perigo" onPress={() => void acao(item.id, 'rejeitar')} />
        </Cartao>
      ))}
    </Tela>
  );
}
