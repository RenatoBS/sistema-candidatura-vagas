import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { api } from '@/api/cliente';
import { useAuth } from '@/auth/AuthContext';
import { Cabecalho } from '@/design-system/Cabecalho';
import { EstadoVazio } from '@/design-system/EstadoVazio';
import { ItemLista } from '@/design-system/ItemLista';
import { Tela } from '@/design-system/Tela';
import { useConsulta } from '@/hooks/useConsulta';

interface TriagemResumo {
  id: string;
  status: string;
  retryAtual: number;
  perguntaAtual: number;
}

export default function TriagensDaVaga() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { sessao, accessToken } = useAuth();
  const empresaId = sessao?.empresaAtivaId ?? sessao?.empresas[0]?.empresaId ?? '';
  const consulta = useConsulta(
    ['triagens', id ?? ''],
    () => api<{ itens: TriagemResumo[] }>(`/empresas/${empresaId}/vagas/${id}/triagens`, {}, accessToken),
    empresaId,
  );
  const itens = consulta.data?.itens ?? [];

  return (
    <Tela>
      <Cabecalho titulo={t('triagem.titulo')} voltar />
      {consulta.isLoading ? <EstadoVazio titulo={t('comum.carregando')} /> : null}
      {!consulta.isLoading && itens.length === 0 ? <EstadoVazio titulo={t('triagem.vazia')} /> : null}
      {itens.map((item) => (
        <ItemLista
          key={item.id}
          titulo={`${t('triagem.status')}: ${item.status}`}
          detalhe={`${t('triagem.retries')}: ${item.retryAtual}`}
          onPress={() => router.push(`/empresa/triagens/${item.id}`)}
        />
      ))}
    </Tela>
  );
}
