import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';

import { api, ErroApi } from '@/api/cliente';
import { useAuth } from '@/auth/AuthContext';
import { Banner } from '@/design-system/Banner';
import { Button } from '@/design-system/Button';
import { Cabecalho } from '@/design-system/Cabecalho';
import { Campo } from '@/design-system/Campo';
import { Cartao } from '@/design-system/Cartao';
import { EstadoVazio } from '@/design-system/EstadoVazio';
import { estilos } from '@/design-system/estilos';
import { Tela } from '@/design-system/Tela';
import { useConsulta } from '@/hooks/useConsulta';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { usePermissao } from '@/hooks/usePermissao';

interface Membro {
  id: string;
  papeis: string[];
  status: string;
}

export default function MembrosScreen() {
  const { t } = useTranslation();
  const { accessToken } = useAuth();
  const empresaId = useEmpresaAtiva();
  const pode = usePermissao('gerenciar_membros', empresaId);
  const [email, setEmail] = useState('');
  const [erro, setErro] = useState('');
  const consulta = useConsulta(['membros'], () => api<Membro[]>(`/empresas/${empresaId}/membros`, {}, accessToken), empresaId);

  async function convidar(papel: 'RECRUTADOR' | 'AVALIADOR') {
    setErro('');
    try {
      await api(
        `/empresas/${empresaId}/membros/convites`,
        { method: 'POST', body: JSON.stringify({ email, papeis: [papel] }) },
        accessToken,
      );
      setEmail('');
      await consulta.refetch();
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : t('comum.erro'));
    }
  }

  if (!pode) {
    return (
      <Tela>
        <Cabecalho titulo={t('empresa.membros')} voltar />
        <EstadoVazio titulo={t('comum.erro')} />
      </Tela>
    );
  }

  const membros = consulta.data ?? [];

  return (
    <Tela teclado>
      <Cabecalho titulo={t('empresa.membros')} voltar />
      {erro ? <Banner tipo="erro" texto={erro} /> : null}
      {consulta.isLoading ? <EstadoVazio titulo={t('comum.carregando')} /> : null}
      {consulta.isError ? <EstadoVazio titulo={t('comum.erroCarregar')} /> : null}
      {!consulta.isLoading && !consulta.isError && membros.length === 0 ? <EstadoVazio titulo={t('admin.vazia')} /> : null}
      {membros.map((membro) => (
        <Cartao key={membro.id}>
          <Text style={estilos.tituloItem}>{membro.papeis.join(', ')}</Text>
          <Text style={estilos.mudo}>{membro.status}</Text>
        </Cartao>
      ))}
      <Campo label={t('auth.email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <Button label={t('empresa.papelRecrutador')} onPress={() => void convidar('RECRUTADOR')} />
      <Button label={t('empresa.papelAvaliador')} variante="secundario" onPress={() => void convidar('AVALIADOR')} />
    </Tela>
  );
}
