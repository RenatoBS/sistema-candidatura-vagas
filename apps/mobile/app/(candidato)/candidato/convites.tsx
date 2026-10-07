import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Text } from 'react-native';

import { api } from '@/api/cliente';
import { useAuth } from '@/auth/AuthContext';
import { Banner } from '@/design-system/Banner';
import { Button } from '@/design-system/Button';
import { Cabecalho } from '@/design-system/Cabecalho';
import { Cartao } from '@/design-system/Cartao';
import { Chip } from '@/design-system/Chip';
import { EstadoVazio } from '@/design-system/EstadoVazio';
import { estilos } from '@/design-system/estilos';
import { Tela } from '@/design-system/Tela';
import { useConsulta } from '@/hooks/useConsulta';

type Convite = {
  id: string;
  vaga?: { id: string; titulo: string };
  status?: string;
  expiraEm?: string;
};

const consentimentos = [{ tipo: 'TERMOS', concedido: true, versaoTermo: '2026-10-06' }];

export default function Convites() {
  const { t } = useTranslation();
  const { accessToken } = useAuth();
  const [erro, setErro] = useState('');
  const q = useConsulta<{ convites: Convite[] }>(['convites'], () =>
    api<{ convites: Convite[] }>('/candidatos/me/convites', {}, accessToken),
  );

  async function agir(id: string, acao: 'aceitar' | 'recusar') {
    try {
      await api(
        `/candidatos/me/convites/${id}/${acao}`,
        {
          method: 'POST',
          body: acao === 'aceitar' ? JSON.stringify({ consentimentos }) : undefined,
        },
        accessToken,
      );
      await q.refetch();
    } catch (e) {
      setErro(e instanceof Error ? e.message : t('comum.erro'));
    }
  }

  const convites = q.data?.convites ?? [];

  return (
    <Tela>
      <Cabecalho titulo={t('candidato.convitesTitulo')} voltar />
      {q.isLoading ? <EstadoVazio titulo={t('comum.carregando')} /> : null}
      {q.isError ? <EstadoVazio titulo={t('candidato.convitesErro')} /> : null}
      {erro ? <Banner tipo="erro" texto={erro} /> : null}
      {!q.isLoading && !q.isError && convites.length === 0 ? <EstadoVazio titulo={t('candidato.convitesVazios')} /> : null}
      {convites.map((c) => (
        <Cartao key={c.id}>
          <Text style={estilos.tituloItem}>{c.vaga?.titulo ?? t('comum.vaga')}</Text>
          <Chip texto={c.status ?? 'PENDENTE'} />
          <Button
            label={t('comum.aceitar')}
            onPress={() =>
              Alert.alert(t('candidato.aceitarConviteTitulo'), t('candidato.aceitarConviteTexto'), [
                { text: t('comum.cancelar'), style: 'cancel' },
                { text: t('comum.aceitar'), onPress: () => void agir(c.id, 'aceitar') },
              ])
            }
          />
          <Button
            label={t('comum.recusar')}
            variante="secundario"
            onPress={() =>
              Alert.alert(t('candidato.recusarConviteTitulo'), t('candidato.recusarConviteTexto'), [
                { text: t('comum.cancelar'), style: 'cancel' },
                { text: t('comum.recusar'), style: 'destructive', onPress: () => void agir(c.id, 'recusar') },
              ])
            }
          />
        </Cartao>
      ))}
    </Tela>
  );
}
