import { Link, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { api, ErroApi } from '@/api/cliente';
import { useAuth } from '@/auth/AuthContext';
import { Banner } from '@/design-system/Banner';
import { Button } from '@/design-system/Button';
import { Campo } from '@/design-system/Campo';
import { colors, spacing } from '@/design-system/tokens';
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
  const { id } = useLocalSearchParams<{ id: string }>();
  const { sessao, accessToken } = useAuth();
  const empresaId = sessao?.empresaAtivaId ?? sessao?.empresas[0]?.empresaId ?? '';
  const podeEditar = usePermissao('criar_vaga', empresaId);
  const podePublicar = usePermissao('publicar_vaga', empresaId);
  const vaga = useConsulta(
    ['vaga', id ?? ''],
    () => api<VagaEmpresa>(`/empresas/${empresaId}/vagas/${id}`, {}, accessToken),
    empresaId,
  );
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
    <ScrollView style={styles.tela} contentContainerStyle={styles.conteudo}>
      <Text style={styles.titulo}>{dados?.titulo ?? t('vaga.detalhe')}</Text>
      {erro ? <Banner tipo="erro" texto={erro} /> : null}
      <View style={styles.bloco}>
        <Link href={`/empresa/vagas/${id}/candidatos`} style={styles.link}>
          Ver candidatos da vaga
        </Link>
        <Link href={`/empresa/vagas/${id}/sugestoes`} style={styles.link}>
          Ver sugestões de match
        </Link>
      </View>
      <Text style={styles.texto}>
        {t('vaga.status')}: {dados?.status ?? '—'}
      </Text>
      <Text style={styles.texto}>
        {t('vaga.ate')}: {dados?.prazoInscricoesBrasilia ?? '—'}
      </Text>
      {podeEditar && dados?.status === 'RASCUNHO' ? (
        <View style={styles.bloco}>
          <Button label={t('vaga.processo')} onPress={() => void agir(`/vagas/${id}/processo`, 'PUT', processoPadrao())} />
          <Campo label={t('vaga.pergunta')} value={pergunta} onChangeText={setPergunta} />
          {etapa ? (
            <Button
              label={t('vaga.adicionar')}
              onPress={() => void agir(`/vagas/${id}/etapas/${etapa.id}/perguntas`, 'POST', { enunciado: pergunta }).then(() => setPergunta(''))}
            />
          ) : null}
          {etapa ? <Button label={t('vaga.sugerir')} variante="secundario" onPress={() => void agir(`/vagas/${id}/etapas/${etapa.id}/perguntas/sugestoes`, 'POST')} /> : null}
        </View>
      ) : null}
      {etapa?.perguntas.map((item) => (
        <Text key={item.id} style={styles.texto}>
          {item.enunciado} ({item.tempoLimiteEfetivoSegundos}s)
        </Text>
      ))}
      {etapa?.sugestoes.map((item) => (
        <View key={item.id} style={styles.bloco}>
          <Text style={styles.texto}>{item.enunciado}</Text>
          <Button label={t('vaga.aceitar')} onPress={() => void agir(`/perguntas/${item.id}/aceitar`, 'POST', {})} />
          <Button label={t('vaga.descartar')} variante="secundario" onPress={() => void agir(`/perguntas/${item.id}/descartar`, 'POST')} />
        </View>
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
    </ScrollView>
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

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  conteudo: { padding: spacing.lg, gap: spacing.sm },
  titulo: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  texto: { color: colors.text },
  bloco: { gap: spacing.sm, marginTop: spacing.sm },
  link: { color: colors.primary, fontSize: 16 },
});
