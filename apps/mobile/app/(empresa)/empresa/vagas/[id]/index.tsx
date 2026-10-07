import { useLocalSearchParams, useRouter } from 'expo-router';
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
import { Chip } from '@/design-system/Chip';
import { estilos } from '@/design-system/estilos';
import { ItemLista } from '@/design-system/ItemLista';
import { Tela } from '@/design-system/Tela';
import { useConsulta } from '@/hooks/useConsulta';
import { usePermissao } from '@/hooks/usePermissao';

interface Sugestao {
  id: string;
  enunciado: string;
}

interface Etapa {
  id: string;
  tipo: string;
  numeroPerguntas: number;
  perguntas: Array<{ id: string; enunciado: string; tempoLimiteEfetivoSegundos: number }>;
  sugestoes: Sugestao[];
}

interface VagaEmpresa {
  id: string;
  titulo: string;
  status: string;
  prazoInscricoesBrasilia: string | null;
  processo: { etapas: Etapa[] } | null;
}

export default function VagaEmpresaScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { sessao, accessToken } = useAuth();
  const empresaId = sessao?.empresaAtivaId ?? sessao?.empresas[0]?.empresaId ?? '';
  const podeEditar = usePermissao('criar_vaga', empresaId);
  const podePublicar = usePermissao('publicar_vaga', empresaId);
  const vaga = useConsulta(['vaga', id ?? ''], () => api<VagaEmpresa>(`/empresas/${empresaId}/vagas/${id}`, {}, accessToken), empresaId);
  const [pergunta, setPergunta] = useState('');
  const [prazo, setPrazo] = useState('');
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');

  async function agir(caminho: string, metodo: string, corpo?: unknown) {
    setErro('');
    try {
      await api(`/empresas/${empresaId}${caminho}`, { method: metodo, body: corpo ? JSON.stringify(corpo) : undefined }, accessToken);
      await vaga.refetch();
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : t('comum.erro'));
    }
  }

  const dados = vaga.data;
  const etapa = dados?.processo?.etapas[0];

  return (
    <Tela teclado>
      <Cabecalho titulo={dados?.titulo ?? t('vaga.detalhe')} voltar />
      {erro ? <Banner tipo="erro" texto={erro} /> : null}
      <ItemLista titulo={t('vaga.verCandidatos')} onPress={() => router.push(`/empresa/vagas/${id}/candidatos`)} />
      <ItemLista titulo={t('vaga.verSugestoes')} onPress={() => router.push(`/empresa/vagas/${id}/sugestoes`)} />
      <ItemLista titulo={t('vaga.triagens')} onPress={() => router.push(`/empresa/vagas/${id}/triagens`)} />
      <ItemLista titulo={t('vaga.voz')} onPress={() => router.push(`/empresa/vagas/${id}/voz`)} />
      <ItemLista titulo={t('vaga.ranking')} onPress={() => router.push(`/empresa/vagas/${id}/ranking`)} />
      <Chip texto={`${t('vaga.status')}: ${dados?.status ?? '—'}`} />
      <Text style={estilos.mudo}>
        {t('vaga.ate')}: {dados?.prazoInscricoesBrasilia ?? '—'}
      </Text>
      {podeEditar && dados?.status === 'RASCUNHO' ? (
        <Cartao>
          <Button label={t('vaga.processo')} onPress={() => void agir(`/vagas/${id}/processo`, 'PUT', processoPadrao())} />
          <Campo label={t('vaga.pergunta')} value={pergunta} onChangeText={setPergunta} />
          {etapa ? (
            <Button
              label={t('vaga.adicionar')}
              onPress={() => void agir(`/vagas/${id}/etapas/${etapa.id}/perguntas`, 'POST', { enunciado: pergunta }).then(() => setPergunta(''))}
            />
          ) : null}
          {etapa ? (
            <Button
              label={t('vaga.sugerir')}
              variante="secundario"
              onPress={() => void agir(`/vagas/${id}/etapas/${etapa.id}/perguntas/sugestoes`, 'POST')}
            />
          ) : null}
        </Cartao>
      ) : null}
      {etapa?.perguntas.map((item) => (
        <Cartao key={item.id}>
          <Text style={estilos.corpo}>
            {item.enunciado} ({item.tempoLimiteEfetivoSegundos}s)
          </Text>
        </Cartao>
      ))}
      {etapa?.sugestoes.map((item) => (
        <Cartao key={item.id}>
          <Text style={estilos.corpo}>{item.enunciado}</Text>
          <Button label={t('vaga.aceitar')} onPress={() => void agir(`/perguntas/${item.id}/aceitar`, 'POST', {})} />
          <Button label={t('vaga.descartar')} variante="secundario" onPress={() => void agir(`/perguntas/${item.id}/descartar`, 'POST')} />
        </Cartao>
      ))}
      <Campo label={t('vaga.prazo')} value={prazo} onChangeText={setPrazo} placeholder={t('vaga.prazoAjuda')} autoCapitalize="none" />
      {dados?.status === 'RASCUNHO' ? (
        <Button label={t('vaga.prazo')} variante="secundario" onPress={() => void agir(`/vagas/${id}`, 'PATCH', { prazoInscricoes: prazo })} />
      ) : null}
      {podePublicar && dados?.status === 'RASCUNHO' ? (
        <Button label={t('vaga.publicar')} onPress={() => void agir(`/vagas/${id}/publicar`, 'POST')} />
      ) : null}
      {dados?.status === 'PUBLICADA' || dados?.status === 'INSCRICOES_ENCERRADAS' ? (
        <Button label={t('vaga.prorrogar')} onPress={() => void agir(`/vagas/${id}/prorrogar`, 'POST', { prazoInscricoes: prazo })} />
      ) : null}
      {dados?.status === 'PUBLICADA' || dados?.status === 'INSCRICOES_ENCERRADAS' ? (
        <Button label={t('vaga.pausar')} variante="secundario" onPress={() => void agir(`/vagas/${id}/pausar`, 'POST')} />
      ) : null}
      {dados?.status === 'PAUSADA' ? <Button label={t('vaga.retomar')} onPress={() => void agir(`/vagas/${id}/retomar`, 'POST')} /> : null}
      <Campo label={t('vaga.motivo')} value={motivo} onChangeText={setMotivo} />
      {dados && dados.status !== 'FECHADA' ? (
        <Button label={t('vaga.fechar')} variante="perigo" onPress={() => void agir(`/vagas/${id}/fechar`, 'POST', { motivo })} />
      ) : null}
      <Button label={t('vaga.duplicar')} variante="secundario" onPress={() => void agir(`/vagas/${id}/duplicar`, 'POST')} />
    </Tela>
  );
}

function processoPadrao() {
  return {
    tempoPadraoPorPergunta: 180,
    etapas: [
      { ordem: 1, tipo: 'TRIAGEM_WHATSAPP', numeroPerguntas: 5 },
      { ordem: 2, tipo: 'ENTREVISTA_VOZ', numeroPerguntas: 5 },
      { ordem: 3, tipo: 'REVISAO_HUMANA', numeroPerguntas: 0 },
    ],
  };
}
