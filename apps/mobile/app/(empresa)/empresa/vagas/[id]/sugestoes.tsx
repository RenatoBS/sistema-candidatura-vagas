import type { SugestoesMatchVagaResponse } from '@scv/contracts';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';

import { api, ErroApi } from '@/api/cliente';
import { useAuth } from '@/auth/AuthContext';
import { Banner } from '@/design-system/Banner';
import { Button } from '@/design-system/Button';
import { Cabecalho } from '@/design-system/Cabecalho';
import { Cartao } from '@/design-system/Cartao';
import { EstadoVazio } from '@/design-system/EstadoVazio';
import { estilos } from '@/design-system/estilos';
import { Tela } from '@/design-system/Tela';
import { useConsulta } from '@/hooks/useConsulta';

export default function SugestoesDaVaga() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { accessToken } = useAuth();
  const [erro, setErro] = useState('');
  const consulta = useConsulta<SugestoesMatchVagaResponse>(['sugestoes-match', id ?? ''], () =>
    api<SugestoesMatchVagaResponse>(`/vagas/${id}/sugestoes-match`, {}, accessToken),
  );

  async function convidar(sugestaoId: string) {
    setErro('');
    try {
      await api(`/vagas/${id}/sugestoes-match/${sugestaoId}/convidar`, { method: 'POST' }, accessToken);
      await consulta.refetch();
    } catch (error) {
      setErro(error instanceof ErroApi && error.status === 409 ? t('vaga.jaConvidado') : t('vaga.conviteErro'));
    }
  }

  const itens = consulta.data?.sugestoes ?? [];

  return (
    <Tela>
      <Cabecalho titulo={t('vaga.verSugestoes')} voltar />
      {consulta.isLoading ? <EstadoVazio titulo={t('comum.carregando')} /> : null}
      {consulta.isError ? <EstadoVazio titulo={t('vaga.sugestoesErro')} /> : null}
      {erro ? <Banner tipo="erro" texto={erro} /> : null}
      {!consulta.isLoading && !consulta.isError && itens.length === 0 ? <EstadoVazio titulo={t('vaga.sugestoesVazias')} /> : null}
      {itens.map((item) => (
        <Cartao key={item.id}>
          <Text style={estilos.tituloItem}>{item.candidato.primeiroNome}</Text>
          <Text style={estilos.legenda}>{t('vaga.compatibilidade', { n: Math.round(item.compatibilidade * 100) })}</Text>
          <Text style={estilos.mudo}>
            {t('vaga.emComum')}: {item.explicacao.atendidas.join(', ') || t('vaga.nenhumaInformada')}
          </Text>
          <Text style={estilos.mudo}>
            {t('vaga.faltantes')}: {item.explicacao.faltantes.join(', ') || t('vaga.nenhumaApontada')}
          </Text>
          {item.status === 'CONVIDADA' || item.status === 'ACEITA' ? (
            <Text style={estilos.corpo}>{t('vaga.conviteEnviado')}</Text>
          ) : (
            <Button label={t('vaga.convidar')} onPress={() => void convidar(item.id)} />
          )}
        </Cartao>
      ))}
    </Tela>
  );
}
