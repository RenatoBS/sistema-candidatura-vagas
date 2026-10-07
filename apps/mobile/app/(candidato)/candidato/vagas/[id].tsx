import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Text, View } from 'react-native';

import { api, ErroApi } from '@/api/cliente';
import { useAuth } from '@/auth/AuthContext';
import { CONSENTIMENTOS_CANDIDATURA, conviteDaVaga } from '@/candidatura/regras';
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

interface Convite {
  id: string;
  vaga?: { id: string; titulo: string };
}

export default function DetalheVagaCandidatoScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { accessToken } = useAuth();
  const [mensagem, setMensagem] = useState('');
  const [tipoMensagem, setTipoMensagem] = useState<'ok' | 'erro'>('ok');
  const vaga = useConsulta(['vaga-publica', id ?? ''], () => api<VagaPublica>(`/vagas-publicas/${id}`), null);
  const convites = useConsulta<{ convites: Convite[] }>(['convites'], () =>
    api<{ convites: Convite[] }>('/candidatos/me/convites', {}, accessToken),
  );
  const dados = vaga.data;
  const convite = conviteDaVaga(convites.data?.convites ?? [], id ?? '');

  async function candidatar() {
    try {
      await api(
        `/vagas-publicas/${id}/candidaturas`,
        { method: 'POST', body: JSON.stringify({ consentimentos: CONSENTIMENTOS_CANDIDATURA }) },
        accessToken,
      );
      setTipoMensagem('ok');
      setMensagem(t('candidato.candidaturaEnviada'));
    } catch (e) {
      setTipoMensagem('erro');
      setMensagem(e instanceof ErroApi && e.status === 409 ? t('candidato.jaCandidatou') : t('candidato.candidaturaErro'));
    }
  }

  async function responderConvite(conviteId: string, acao: 'aceitar' | 'recusar') {
    try {
      await api(
        `/candidatos/me/convites/${conviteId}/${acao}`,
        {
          method: 'POST',
          body: acao === 'aceitar' ? JSON.stringify({ consentimentos: CONSENTIMENTOS_CANDIDATURA }) : undefined,
        },
        accessToken,
      );
      setTipoMensagem('ok');
      setMensagem(acao === 'aceitar' ? t('candidato.conviteAceito') : t('candidato.conviteRecusado'));
      await convites.refetch();
    } catch (e) {
      setTipoMensagem('erro');
      setMensagem(e instanceof ErroApi ? e.message : t('comum.erro'));
    }
  }

  const rodape = convite ? (
    <>
      <Button
        label={t('comum.aceitar')}
        onPress={() =>
          Alert.alert(t('candidato.aceitarConviteTitulo'), t('candidato.aceitarConviteTexto'), [
            { text: t('comum.cancelar'), style: 'cancel' },
            { text: t('comum.aceitar'), onPress: () => void responderConvite(convite.id, 'aceitar') },
          ])
        }
      />
      <Button
        label={t('comum.recusar')}
        variante="secundario"
        onPress={() =>
          Alert.alert(t('candidato.recusarConviteTitulo'), t('candidato.recusarConviteTexto'), [
            { text: t('comum.cancelar'), style: 'cancel' },
            { text: t('comum.recusar'), style: 'destructive', onPress: () => void responderConvite(convite.id, 'recusar') },
          ])
        }
      />
    </>
  ) : (
    <Button label={t('candidato.candidatar')} onPress={() => void candidatar()} />
  );

  return (
    <Tela rodape={rodape}>
      <Cabecalho titulo={dados?.titulo ?? t('vaga.detalhe')} voltar />
      {vaga.isLoading ? <Text style={estilos.mudo}>{t('comum.carregando')}</Text> : null}
      {vaga.isError ? <Banner tipo="erro" texto={t('comum.erroCarregar')} /> : null}
      {convite ? <Banner tipo="aviso" texto={t('candidato.conviteVaga')} /> : null}
      <Text style={estilos.corpo}>{dados?.descricao}</Text>
      <View style={estilos.chips}>
        {dados?.senioridade ? <Chip texto={t(`vaga.opcaoSenioridade.${dados.senioridade}`, { defaultValue: dados.senioridade })} /> : null}
        {dados?.modelo ? <Chip texto={t(`vaga.opcaoModelo.${dados.modelo}`, { defaultValue: dados.modelo })} /> : null}
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
