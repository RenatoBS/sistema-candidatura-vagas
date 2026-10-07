import type { NotificacaoDto, NotificacoesResponse } from '@scv/contracts';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';

import { api } from '@/api/cliente';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/design-system/Button';
import { Cabecalho } from '@/design-system/Cabecalho';
import { Cartao } from '@/design-system/Cartao';
import { EstadoVazio } from '@/design-system/EstadoVazio';
import { estilos } from '@/design-system/estilos';
import { Tela } from '@/design-system/Tela';
import { useConsulta } from '@/hooks/useConsulta';

export default function Notificacoes() {
  const { t } = useTranslation();
  const router = useRouter();
  const { accessToken } = useAuth();
  const consulta = useConsulta<NotificacoesResponse>(['notificacoes'], () => api<NotificacoesResponse>('/notificacoes', {}, accessToken));

  async function marcar(id?: string) {
    await api(id ? `/notificacoes/${id}/lida` : '/notificacoes/lidas', { method: 'POST' }, accessToken);
    await consulta.refetch();
  }

  function abrir(item: NotificacaoDto) {
    void marcar(item.id);
    const dados = item.dados;
    const id = String(dados.vagaId ?? dados.candidaturaId ?? dados.sugestaoId ?? '');
    if (id) router.push(item.tipo === 'CANDIDATO_NOVO' ? `/candidato/candidaturas/${id}` : `/candidato/vagas/${id}`);
  }

  const itens = consulta.data?.itens ?? [];
  const rotulos: Record<string, string> = {
    CANDIDATO_NOVO: t('notificacoes.candidatoNovo'),
    MATCH_FORTE: t('notificacoes.matchForte'),
    CONVITE_MATCH: t('notificacoes.conviteMatch'),
  };

  return (
    <Tela comAbas>
      <Cabecalho titulo={t('candidato.notificacoesTitulo')} />
      {consulta.isLoading ? <EstadoVazio titulo={t('comum.carregando')} /> : null}
      {consulta.isError ? (
        <>
          <EstadoVazio titulo={t('candidato.notificacoesErro')} />
          <Button label={t('comum.tentarNovamente')} onPress={() => void consulta.refetch()} />
        </>
      ) : null}
      {!consulta.isLoading && !consulta.isError ? (
        <Button label={t('comum.marcarTodas')} variante="secundario" onPress={() => void marcar()} />
      ) : null}
      {!consulta.isLoading && !consulta.isError && itens.length === 0 ? (
        <EstadoVazio titulo={t('candidato.notificacoesVazias')} />
      ) : null}
      {itens.map((item) => (
        <Cartao key={item.id} destaque={!item.lida && !item.lidaEm}>
          <Text style={estilos.tituloItem}>
            {item.resumo ? t('candidato.novosCandidatos', { n: item.agrupadas }) : (rotulos[item.tipo] ?? t('candidato.atualizacao'))}
          </Text>
          <Text style={estilos.mudo}>
            {String(item.dados.vagaTitulo ?? (item.resumo ? t('candidato.movimentacoes') : t('candidato.novaAtualizacao')))}
          </Text>
          {!item.lida && !item.lidaEm ? <Button label={t('comum.marcarLida')} onPress={() => void marcar(item.id)} /> : null}
          <Button label={t('comum.abrir')} variante="secundario" onPress={() => abrir(item)} />
        </Cartao>
      ))}
    </Tela>
  );
}
