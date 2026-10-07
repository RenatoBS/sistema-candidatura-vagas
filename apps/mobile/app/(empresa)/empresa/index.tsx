import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';

import { api } from '@/api/cliente';
import { useAuth } from '@/auth/AuthContext';
import { TrocaVisao } from '@/componentes/TrocaVisao';
import { Cabecalho } from '@/design-system/Cabecalho';
import { Chip } from '@/design-system/Chip';
import { estilos } from '@/design-system/estilos';
import { ItemLista } from '@/design-system/ItemLista';
import { Tela } from '@/design-system/Tela';
import { useConsulta } from '@/hooks/useConsulta';
import { usePermissao } from '@/hooks/usePermissao';

interface EmpresaResumo {
  statusVerificacao: string;
  nomeFantasia: string;
}

export default function EmpresaHome() {
  const { t } = useTranslation();
  const router = useRouter();
  const { sessao, accessToken } = useAuth();
  const empresaId = sessao?.empresaAtivaId ?? sessao?.empresas[0]?.empresaId;
  const podeMembros = usePermissao('gerenciar_membros', empresaId);
  const empresa = useConsulta(['empresa'], () => api<EmpresaResumo>(`/empresas/${empresaId}`, {}, accessToken), empresaId);

  return (
    <Tela comAbas>
      <Cabecalho titulo={empresa.data?.nomeFantasia ?? t('empresa.titulo')} />
      <Chip texto={`${t('empresa.status')}: ${empresa.data?.statusVerificacao ?? '—'}`} />
      <ItemLista titulo={t('empresa.status')} onPress={() => router.push('/empresa/verificacao')} />
      <ItemLista titulo={t('empresa.whatsapp')} onPress={() => router.push('/empresa/whatsapp')} />
      {podeMembros ? <ItemLista titulo={t('empresa.membros')} onPress={() => router.push('/empresa/membros')} /> : null}
      <ItemLista titulo={t('empresa.preferencias')} onPress={() => router.push('/empresa/notificacoes-preferencias')} />
      <Text style={estilos.legenda}>{t('visao.trocar')}</Text>
      <TrocaVisao />
    </Tela>
  );
}
