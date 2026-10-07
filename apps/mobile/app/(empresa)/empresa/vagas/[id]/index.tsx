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
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { usePermissao } from '@/hooks/usePermissao';
import { etapasComPerguntas, etapasIncompletas, processoPronto, situacaoEtapa, type EtapaProcesso } from '@/vaga/processo';

interface VagaEmpresa {
  id: string;
  titulo: string;
  status: string;
  prazoInscricoesBrasilia: string | null;
  processo: { etapas: EtapaProcesso[] } | null;
}

export default function VagaEmpresaScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { accessToken } = useAuth();
  const empresaId = useEmpresaAtiva();
  const podeEditar = usePermissao('criar_vaga', empresaId);
  const podePublicar = usePermissao('publicar_vaga', empresaId);
  const vaga = useConsulta(['vaga', id ?? ''], () => api<VagaEmpresa>(`/empresas/${empresaId}/vagas/${id}`, {}, accessToken), empresaId);
  const [perguntas, setPerguntas] = useState<Record<string, string>>({});
  const [prazo, setPrazo] = useState('');
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);

  async function agir(caminho: string, metodo: string, corpo?: unknown): Promise<boolean> {
    setErro('');
    setOcupado(true);
    try {
      await api(`/empresas/${empresaId}${caminho}`, { method: metodo, body: corpo ? JSON.stringify(corpo) : undefined }, accessToken);
      await vaga.refetch();
      return true;
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : t('comum.erro'));
      return false;
    } finally {
      setOcupado(false);
    }
  }

  async function adicionarPergunta(etapaId: string) {
    const enunciado = (perguntas[etapaId] ?? '').trim();
    if (!enunciado) {
      setErro(t('vaga.perguntaVazia'));
      return;
    }
    const ok = await agir(`/vagas/${id}/etapas/${etapaId}/perguntas`, 'POST', { enunciado });
    if (ok) setPerguntas((atual) => ({ ...atual, [etapaId]: '' }));
  }

  const dados = vaga.data;
  const rascunho = dados?.status === 'RASCUNHO';
  const editavel = podeEditar && rascunho;
  const todasEtapas = dados?.processo?.etapas ?? [];
  const etapas = etapasComPerguntas(todasEtapas);
  const incompletas = etapasIncompletas(todasEtapas);
  const semProcesso = todasEtapas.length === 0;
  const podeEnviarPublicacao = processoPronto(todasEtapas);
  const nomeEtapa = (tipo: string) => t(`vaga.etapaTipo.${tipo}`, { defaultValue: tipo });
  const faltaPublicar = semProcesso
    ? t('vaga.publicarSemProcesso')
    : t('vaga.publicarFalta', { etapas: incompletas.map((etapa) => nomeEtapa(etapa.tipo)).join(', ') });

  return (
    <Tela teclado>
      <Cabecalho titulo={dados?.titulo ?? t('vaga.detalhe')} voltar />
      {erro ? <Banner tipo="erro" texto={erro} /> : null}
      {vaga.isLoading ? <Text style={estilos.mudo}>{t('comum.carregando')}</Text> : null}
      {vaga.isError ? <Banner tipo="erro" texto={t('comum.erroCarregar')} /> : null}
      <ItemLista titulo={t('vaga.verCandidatos')} onPress={() => router.push(`/empresa/vagas/${id}/candidatos`)} />
      <ItemLista titulo={t('vaga.verSugestoes')} onPress={() => router.push(`/empresa/vagas/${id}/sugestoes`)} />
      <ItemLista titulo={t('vaga.triagens')} onPress={() => router.push(`/empresa/vagas/${id}/triagens`)} />
      <ItemLista titulo={t('vaga.voz')} onPress={() => router.push(`/empresa/vagas/${id}/voz`)} />
      <ItemLista titulo={t('vaga.ranking')} onPress={() => router.push(`/empresa/vagas/${id}/ranking`)} />
      <Chip texto={`${t('vaga.status')}: ${dados?.status ?? '—'}`} />
      <Text style={estilos.mudo}>
        {t('vaga.ate')}: {dados?.prazoInscricoesBrasilia ?? '—'}
      </Text>
      {editavel && semProcesso && dados ? (
        <Button
          label={t('vaga.processo')}
          desabilitado={ocupado}
          onPress={() => void agir(`/vagas/${id}/processo`, 'PUT', processoPadrao())}
        />
      ) : null}
      {etapas.map((etapa) => {
        const situacao = situacaoEtapa(etapa);
        const cheia = situacao.aprovadas >= situacao.numeroPerguntas;
        const semVagaParaSugestao = situacao.aprovadas + situacao.pendentes >= situacao.numeroPerguntas;
        return (
          <Cartao key={etapa.id} destaque={!situacao.completa}>
            <Text style={estilos.tituloItem}>{nomeEtapa(etapa.tipo)}</Text>
            <Text style={estilos.mudo}>
              {t('vaga.contadorEtapa', {
                aprovadas: situacao.aprovadas,
                total: situacao.numeroPerguntas,
                pendentes: situacao.pendentes,
              })}
            </Text>
            {situacao.completa ? <Text style={estilos.legenda}>{t('vaga.etapaCompleta')}</Text> : null}
            {editavel && !cheia ? (
              <>
                <Campo
                  label={`${t('vaga.pergunta')} · ${nomeEtapa(etapa.tipo)}`}
                  value={perguntas[etapa.id] ?? ''}
                  onChangeText={(valor) => setPerguntas((atual) => ({ ...atual, [etapa.id]: valor }))}
                  multiline
                />
                <Button label={t('vaga.adicionar')} desabilitado={ocupado} onPress={() => void adicionarPergunta(etapa.id)} />
                {!semVagaParaSugestao ? (
                  <Button
                    label={t('vaga.sugerir')}
                    variante="secundario"
                    desabilitado={ocupado}
                    onPress={() => void agir(`/vagas/${id}/etapas/${etapa.id}/perguntas/sugestoes`, 'POST')}
                  />
                ) : null}
              </>
            ) : null}
            {etapa.perguntas.length > 0 ? <Text style={estilos.legenda}>{t('vaga.perguntasAprovadas')}</Text> : null}
            {etapa.perguntas.map((item) => (
              <Text key={item.id} style={estilos.corpo}>
                • {item.enunciado} ({item.tempoLimiteEfetivoSegundos}s)
              </Text>
            ))}
            {etapa.sugestoes.length > 0 ? <Text style={estilos.legenda}>{t('vaga.sugestoesPendentes')}</Text> : null}
            {etapa.sugestoes.map((item) => (
              <Cartao key={item.id}>
                <Text style={estilos.corpo}>{item.enunciado}</Text>
                {editavel ? (
                  <>
                    <Button
                      label={t('vaga.aceitar')}
                      desabilitado={ocupado || cheia}
                      onPress={() => void agir(`/perguntas/${item.id}/aceitar`, 'POST', {})}
                    />
                    <Button
                      label={t('vaga.descartar')}
                      variante="secundario"
                      desabilitado={ocupado}
                      onPress={() => void agir(`/perguntas/${item.id}/descartar`, 'POST')}
                    />
                  </>
                ) : null}
              </Cartao>
            ))}
          </Cartao>
        );
      })}
      <Campo label={t('vaga.prazo')} value={prazo} onChangeText={setPrazo} placeholder={t('vaga.prazoAjuda')} autoCapitalize="none" />
      {rascunho ? (
        <Button
          label={t('vaga.salvarPrazo')}
          variante="secundario"
          desabilitado={ocupado}
          onPress={() => void agir(`/vagas/${id}`, 'PATCH', { prazoInscricoes: prazo })}
        />
      ) : null}
      {podePublicar && rascunho ? (
        <>
          {!podeEnviarPublicacao ? <Banner tipo="aviso" texto={faltaPublicar} /> : null}
          <Button
            label={t('vaga.publicar')}
            desabilitado={ocupado || !podeEnviarPublicacao}
            onPress={() => void agir(`/vagas/${id}/publicar`, 'POST')}
          />
        </>
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
