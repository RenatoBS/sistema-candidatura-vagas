import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';

import { api } from '@/api/cliente';
import { useAuth } from '@/auth/AuthContext';
import { Cabecalho } from '@/design-system/Cabecalho';
import { Cartao } from '@/design-system/Cartao';
import { EstadoVazio } from '@/design-system/EstadoVazio';
import { estilos } from '@/design-system/estilos';
import { Tela } from '@/design-system/Tela';
import { useConsulta } from '@/hooks/useConsulta';

interface CandidatoVaga {
  id: string;
  candidato?: { nome?: string; primeiroNome?: string };
  status?: string;
  origem?: string;
}

export default function CandidatosDaVaga() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { accessToken, sessao } = useAuth();
  const empresaId = sessao?.empresaAtivaId ?? sessao?.empresas[0]?.empresaId ?? '';
  const consulta = useConsulta<CandidatoVaga[]>(['candidatos-vaga', id ?? ''], () =>
    api<CandidatoVaga[]>(`/vagas/${id}/candidaturas`, { headers: { 'x-empresa-id': empresaId } }, accessToken),
  );
  const lista = consulta.data ?? [];

  return (
    <Tela>
      <Cabecalho titulo={t('vaga.verCandidatos')} voltar />
      {consulta.isLoading ? <EstadoVazio titulo={t('comum.carregando')} /> : null}
      {consulta.isError ? <EstadoVazio titulo={t('vaga.candidatosErro')} /> : null}
      {!consulta.isLoading && !consulta.isError && lista.length === 0 ? <EstadoVazio titulo={t('vaga.candidatosVazios')} /> : null}
      {lista.map((candidato) => (
        <Cartao key={candidato.id}>
          <Text style={estilos.tituloItem}>{candidato.candidato?.nome ?? candidato.candidato?.primeiroNome ?? t('comum.candidato')}</Text>
          <Text style={estilos.mudo}>
            {t('vaga.status')}: {candidato.status ?? t('vaga.emAnalise')}
          </Text>
          <Text style={estilos.mudo}>
            {t('vaga.origem')}: {candidato.origem ?? t('vaga.candidaturaDireta')}
          </Text>
        </Cartao>
      ))}
    </Tela>
  );
}
