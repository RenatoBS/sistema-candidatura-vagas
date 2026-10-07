import { useLocalSearchParams } from 'expo-router';
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
import { estilos } from '@/design-system/estilos';
import { Tela } from '@/design-system/Tela';
import { useConsulta } from '@/hooks/useConsulta';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { PESOS_RANKING, percentualInteiro } from '@/vaga/opcoes';

interface ItemRanking {
  candidaturaId: string;
  candidatoNome?: string | null;
  scoreFinal: number | null;
  completude: number | null;
  explicacao: { texto?: string };
}

export default function RankingScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { accessToken } = useAuth();
  const empresaId = useEmpresaAtiva();
  const consulta = useConsulta(
    ['ranking', id ?? ''],
    () => api<{ itens: ItemRanking[] }>(`/empresas/${empresaId}/vagas/${id}/ranking`, {}, accessToken),
    empresaId,
  );
  const [pesos, setPesos] = useState<Record<string, string>>({
    perfil: '10',
    habilidades: '25',
    curriculo: '10',
    linkedin: '2',
    triagem: '23',
    voz: '30',
  });
  const [erro, setErro] = useState('');

  async function salvar() {
    setErro('');
    const corpo = Object.fromEntries(PESOS_RANKING.map((chave) => [chave, Number(pesos[chave] ?? 0)]));
    try {
      await api(`/empresas/${empresaId}/vagas/${id}/ranking/pesos`, { method: 'PUT', body: JSON.stringify(corpo) }, accessToken);
      await consulta.refetch();
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : t('comum.erro'));
    }
  }

  const itens = consulta.data?.itens ?? [];

  return (
    <Tela teclado>
      <Cabecalho titulo={t('ranking.titulo')} voltar />
      {erro ? <Banner tipo="erro" texto={erro} /> : null}
      {consulta.isLoading ? <Text style={estilos.mudo}>{t('comum.carregando')}</Text> : null}
      {consulta.isError ? <Banner tipo="erro" texto={t('comum.erroCarregar')} /> : null}
      {!consulta.isLoading && !consulta.isError && itens.length === 0 ? <Text style={estilos.mudo}>{t('ranking.vazio')}</Text> : null}
      {itens.map((item) => (
        <Cartao key={item.candidaturaId}>
          <Text style={estilos.tituloItem}>{item.candidatoNome || t('comum.candidato')}</Text>
          <Text style={estilos.corpo}>{Math.round(item.scoreFinal ?? 0)}/100</Text>
          <Text style={estilos.mudo}>{t('ranking.completudePct', { n: percentualInteiro(item.completude) })}</Text>
          {item.explicacao?.texto ? <Text style={estilos.corpo}>{item.explicacao.texto}</Text> : null}
        </Cartao>
      ))}
      <Text style={estilos.tituloItem}>{t('ranking.pesos')}</Text>
      {PESOS_RANKING.map((chave) => (
        <Campo
          key={chave}
          label={t(`ranking.peso.${chave}`)}
          value={pesos[chave] ?? ''}
          onChangeText={(valor) => setPesos((atual) => ({ ...atual, [chave]: valor }))}
          keyboardType="number-pad"
        />
      ))}
      <Button label={t('ranking.salvar')} onPress={() => void salvar()} />
    </Tela>
  );
}
