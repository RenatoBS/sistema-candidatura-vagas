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

interface RespostaVoz {
  id: string;
  transcricao: string | null;
  expirou: boolean;
}

interface DetalheVoz {
  status: string;
  respostas: RespostaVoz[];
}

export default function GravacaoVozScreen() {
  const { t } = useTranslation();
  const { entrevistaId } = useLocalSearchParams<{ entrevistaId: string }>();
  const { sessao, accessToken } = useAuth();
  const empresaId = sessao?.empresaAtivaId ?? sessao?.empresas[0]?.empresaId ?? '';
  const consulta = useConsulta(
    ['voz-detalhe', entrevistaId ?? ''],
    () => api<DetalheVoz>(`/empresas/${empresaId}/voz/${entrevistaId}`, {}, accessToken),
    empresaId,
  );
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');

  async function ouvir() {
    setErro('');
    try {
      const audio = await api<{ url: string }>(
        `/empresas/${empresaId}/voz/${entrevistaId}/gravacao?motivo=${encodeURIComponent(motivo)}`,
        {},
        accessToken,
      );
      await Linking.openURL(audio.url);
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : t('comum.erro'));
    }
  }

  return (
    <Tela teclado>
      <Cabecalho titulo={t('voz.titulo')} voltar />
      {erro ? <Banner tipo="erro" texto={erro} /> : null}
      <Text style={estilos.corpo}>{consulta.data?.status ?? '—'}</Text>
      <Campo label={t('voz.motivo')} value={motivo} onChangeText={setMotivo} />
      <Button label={t('voz.gravacao')} onPress={() => void ouvir()} />
      {(consulta.data?.respostas ?? []).map((resposta) => (
        <Cartao key={resposta.id}>
          <Text style={estilos.corpo}>
            {t('voz.transcricao')}: {resposta.transcricao ?? '—'}
          </Text>
        </Cartao>
      ))}
    </Tela>
  );
}
