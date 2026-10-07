import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { api } from '@/api/cliente';
import { useAuth } from '@/auth/AuthContext';
import { BotaoSair } from '@/componentes/BotaoSair';
import { TrocaVisao } from '@/componentes/TrocaVisao';
import { Banner } from '@/design-system/Banner';
import { Cabecalho } from '@/design-system/Cabecalho';
import { Chip } from '@/design-system/Chip';
import { ItemLista } from '@/design-system/ItemLista';
import { Tela } from '@/design-system/Tela';
import { useConsulta } from '@/hooks/useConsulta';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { usePermissao } from '@/hooks/usePermissao';

interface EmpresaResumo {
  statusVerificacao: string;
  nomeFantasia: string;
}

export default function EmpresaHome() {
  const { t } = useTranslation();
  const router = useRouter();
  const { accessToken } = useAuth();
  const empresaId = useEmpresaAtiva();
  const podeMembros = usePermissao('gerenciar_membros', empresaId);
  const empresa = useConsulta(['empresa'], () => api<EmpresaResumo>(`/empresas/${empresaId}`, {}, accessToken), empresaId);

  return (
    <Tela comAbas>
      <Cabecalho titulo={empresa.data?.nomeFantasia ?? t('empresa.titulo')} />
      {empresa.isError ? <Banner tipo="erro" texto={t('comum.erroCarregar')} /> : null}
      <Chip texto={`${t('empresa.status')}: ${empresa.data?.statusVerificacao ?? '—'}`} />
      <ItemLista titulo={t('empresa.status')} onPress={() => router.push('/empresa/verificacao')} />
      <ItemLista titulo={t('empresa.whatsapp')} onPress={() => router.push('/empresa/whatsapp')} />
      {podeMembros ? <ItemLista titulo={t('empresa.membros')} onPress={() => router.push('/empresa/membros')} /> : null}
      <ItemLista titulo={t('empresa.preferencias')} onPress={() => router.push('/empresa/notificacoes-preferencias')} />
      <TrocaVisao />
      <BotaoSair />
    </Tela>
  );
}
