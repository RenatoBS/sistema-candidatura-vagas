import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { api } from '@/api/cliente';
import { useAuth } from '@/auth/AuthContext';
import { Cabecalho } from '@/design-system/Cabecalho';
import { EstadoVazio } from '@/design-system/EstadoVazio';
import { ItemLista } from '@/design-system/ItemLista';
import { Tela } from '@/design-system/Tela';
import { useConsulta } from '@/hooks/useConsulta';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';

interface ItemVoz {
  id: string;
  status: string;
}

export default function ListaVozScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { accessToken } = useAuth();
  const empresaId = useEmpresaAtiva();
  const consulta = useConsulta(
    ['voz', id ?? ''],
    () => api<{ itens: ItemVoz[] }>(`/empresas/${empresaId}/vagas/${id}/voz`, {}, accessToken),
    empresaId,
  );
  const itens = consulta.data?.itens ?? [];

  return (
    <Tela>
      <Cabecalho titulo={t('vaga.voz')} voltar />
      {consulta.isLoading ? <EstadoVazio titulo={t('comum.carregando')} /> : null}
      {consulta.isError ? <EstadoVazio titulo={t('comum.erroCarregar')} /> : null}
      {!consulta.isLoading && !consulta.isError && itens.length === 0 ? <EstadoVazio titulo={t('voz.vazia')} /> : null}
      {itens.map((item) => (
        <ItemLista key={item.id} titulo={item.status} onPress={() => router.push(`/empresa/voz/${item.id}`)} />
      ))}
    </Tela>
  );
}
