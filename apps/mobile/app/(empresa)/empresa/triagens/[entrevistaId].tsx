import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Text } from 'react-native';

import { api, ErroApi } from '@/api/cliente';
import { useAuth } from '@/auth/AuthContext';
import { Banner } from '@/design-system/Banner';
import { Button } from '@/design-system/Button';
import { Cabecalho } from '@/design-system/Cabecalho';
import { Campo } from '@/design-system/Campo';
import { Cartao } from '@/design-system/Cartao';
import { estilos } from '@/design-system/estilos';
import { Tela } from '@/design-system/Tela';
import { useConsulta } from '@/hooks/useConsulta';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';

interface RespostaTriagem {
  id: string;
  transcricao: string | null;
  nota: number | null;
  notaOrigem: string | null;
  statusTranscricao: string | null;
  justificativa: string | null;
}

interface DetalheTriagem {
  id: string;
  status: string;
  retryAtual: number;
  perguntaAtual: number;
  respostas: RespostaTriagem[];
}

export default function DetalheTriagemScreen() {
  const { t } = useTranslation();
  const { entrevistaId } = useLocalSearchParams<{ entrevistaId: string }>();
  const { accessToken } = useAuth();
  const empresaId = useEmpresaAtiva();
  const consulta = useConsulta(
    ['triagem', entrevistaId ?? ''],
    () => api<DetalheTriagem>(`/empresas/${empresaId}/triagens/${entrevistaId}`, {}, accessToken),
    empresaId,
  );
  const [motivo, setMotivo] = useState('');
  const [nota, setNota] = useState('');
  const [justificativa, setJustificativa] = useState('');
  const [erro, setErro] = useState('');
  const dados = consulta.data;

  async function ouvir(respostaId: string) {
    setErro('');
    try {
      const audio = await api<{ url: string }>(
        `/empresas/${empresaId}/triagens/${entrevistaId}/respostas/${respostaId}/audio?motivo=${encodeURIComponent(motivo)}`,
        {},
        accessToken,
      );
      await Linking.openURL(audio.url);
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : t('comum.erro'));
    }
  }

  async function revisar(respostaId: string) {
    setErro('');
    try {
      await api(
        `/empresas/${empresaId}/triagens/${entrevistaId}/respostas/${respostaId}/revisao`,
        { method: 'POST', body: JSON.stringify({ nota: Number(nota), justificativa }) },
        accessToken,
      );
      await consulta.refetch();
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : t('comum.erro'));
    }
  }

  return (
    <Tela teclado>
      <Cabecalho titulo={t('triagem.detalhe')} voltar />
      {erro ? <Banner tipo="erro" texto={erro} /> : null}
      {consulta.isLoading ? <Text style={estilos.mudo}>{t('comum.carregando')}</Text> : null}
      {consulta.isError ? <Banner tipo="erro" texto={t('comum.erroCarregar')} /> : null}
      <Text style={estilos.corpo}>
        {t('triagem.status')}: {dados?.status ?? '—'}
      </Text>
      <Text style={estilos.corpo}>
        {t('triagem.retries')}: {dados?.retryAtual ?? 0}
      </Text>
      <Text style={estilos.corpo}>
        {t('triagem.pergunta')}: {dados?.perguntaAtual ?? 0}
      </Text>
      <Campo label={t('triagem.motivo')} value={motivo} onChangeText={setMotivo} />
      <Campo label={t('triagem.nota')} value={nota} onChangeText={setNota} keyboardType="number-pad" />
      <Campo label={t('triagem.justificativa')} value={justificativa} onChangeText={setJustificativa} multiline />
      {(dados?.respostas ?? []).map((resposta) => (
        <Cartao key={resposta.id}>
          <Text style={estilos.corpo}>
            {t('triagem.transcricao')}: {resposta.transcricao ?? '—'}
          </Text>
          <Text style={estilos.mudo}>
            {t('triagem.nota')}: {resposta.nota ?? '—'} ({resposta.notaOrigem ?? '—'})
          </Text>
          {resposta.justificativa ? (
            <Text style={estilos.corpo}>
              {t('triagem.justificativa')}: {resposta.justificativa}
            </Text>
          ) : null}
          <Button label={t('triagem.audio')} variante="secundario" onPress={() => void ouvir(resposta.id)} />
          <Button label={t('triagem.revisar')} onPress={() => void revisar(resposta.id)} />
        </Cartao>
      ))}
    </Tela>
  );
}
