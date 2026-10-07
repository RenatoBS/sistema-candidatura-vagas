import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { api, ErroApi } from '@/api/cliente';
import { useAuth } from '@/auth/AuthContext';
import { Banner } from '@/design-system/Banner';
import { Button } from '@/design-system/Button';
import { Cabecalho } from '@/design-system/Cabecalho';
import { Chip } from '@/design-system/Chip';
import { estilos } from '@/design-system/estilos';
import { Tela } from '@/design-system/Tela';
import { useConsulta } from '@/hooks/useConsulta';

interface VagaPublica {
  titulo: string;
  descricao: string;
  senioridade: string;
  modelo: string;
  localidade: string | null;
  prazoInscricoesBrasilia: string | null;
  habilidades: Array<{ nome: string; nivelMinimo: number }>;
}

export default function DetalheVagaCandidatoScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { accessToken } = useAuth();
  const [mensagem, setMensagem] = useState('');
  const [tipoMensagem, setTipoMensagem] = useState<'ok' | 'erro'>('ok');
  const vaga = useConsulta(['vaga-publica', id ?? ''], () => api<VagaPublica>(`/vagas-publicas/${id}`), null);
  const dados = vaga.data;

  async function candidatar() {
    try {
      await api(
        `/vagas-publicas/${id}/candidaturas`,
        { method: 'POST', body: JSON.stringify({ consentimentos: [{ tipo: 'TERMOS', concedido: true, versaoTermo: '2026-10-06' }] }) },
        accessToken,
      );
      setTipoMensagem('ok');
      setMensagem(t('candidato.candidaturaEnviada'));
    } catch (e) {
      setTipoMensagem('erro');
      setMensagem(e instanceof ErroApi && e.status === 409 ? t('candidato.jaCandidatou') : t('candidato.candidaturaErro'));
    }
  }

  return (
    <Tela rodape={<Button label={t('candidato.candidatar')} onPress={() => void candidatar()} />}>
      <Cabecalho titulo={dados?.titulo ?? t('vaga.detalhe')} voltar />
      {vaga.isLoading ? <Text style={estilos.mudo}>{t('comum.carregando')}</Text> : null}
      <Text style={estilos.corpo}>{dados?.descricao}</Text>
      <View style={estilos.chips}>
        {dados?.senioridade ? <Chip texto={dados.senioridade} /> : null}
        {dados?.modelo ? <Chip texto={dados.modelo} /> : null}
        {dados?.localidade ? <Chip texto={dados.localidade} /> : null}
      </View>
      <Text style={estilos.legenda}>
        {t('vaga.ate')}: {dados?.prazoInscricoesBrasilia ?? '—'}
      </Text>
      {(dados?.habilidades ?? []).map((habilidade) => (
        <Text key={habilidade.nome} style={estilos.corpo}>
          {habilidade.nome} · {t('vaga.nivel')} {habilidade.nivelMinimo}
        </Text>
      ))}
      {mensagem ? <Banner tipo={tipoMensagem} texto={mensagem} /> : null}
    </Tela>
  );
}
