import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/cliente';
import { useAuth } from '@/auth/AuthContext';
import { BotaoSair } from '@/componentes/BotaoSair';
import { TrocaVisao } from '@/componentes/TrocaVisao';
import { Banner } from '@/design-system/Banner';
import { Cabecalho } from '@/design-system/Cabecalho';
import { Chip } from '@/design-system/Chip';
import { ItemLista } from '@/design-system/ItemLista';
import { Tela } from '@/design-system/Tela';
import { colors, radius, tipo } from '@/design-system/tokens';
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
      <Cabecalho titulo={empresa.data?.nomeFantasia ?? t('empresa.titulo')} subtitulo="Gerencie sua presença e mantenha o recrutamento fluindo." />
      {empresa.isError ? <Banner tipo="erro" texto={t('comum.erroCarregar')} /> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('comum.verDetalhes')}
        onPress={() => router.push('/empresa/verificacao')}
        style={({ pressed }) => [styles.status, pressed ? styles.statusPressionado : null]}
      >
        <View>
          <Text style={styles.statusRotulo}>{t('empresa.status')}</Text>
          <Text style={styles.statusTexto}>{empresa.data?.statusVerificacao ?? '—'}</Text>
        </View>
        <Chip texto={t('comum.verDetalhes')} tom="destaque" />
      </Pressable>
      <Text style={styles.secao}>Sua empresa</Text>
      <ItemLista titulo={t('empresa.status')} detalhe="Acompanhe a validação do cadastro" icone="shield-checkmark-outline" onPress={() => router.push('/empresa/verificacao')} />
      <ItemLista titulo={t('empresa.whatsapp')} detalhe="Canal da triagem automática" icone="logo-whatsapp" onPress={() => router.push('/empresa/whatsapp')} />
      {podeMembros ? <ItemLista titulo={t('empresa.membros')} detalhe="Convide e ajuste acessos" icone="people-outline" onPress={() => router.push('/empresa/membros')} /> : null}
      <Text style={styles.secao}>Preferências</Text>
      <ItemLista titulo={t('empresa.preferencias')} icone="notifications-outline" onPress={() => router.push('/empresa/notificacoes-preferencias')} />
      <TrocaVisao />
      <BotaoSair />
    </Tela>
  );
}

const styles = StyleSheet.create({
  status: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18, borderRadius: radius.lg, backgroundColor: colors.tealSoft },
  statusPressionado: { opacity: 0.92 },
  statusRotulo: { ...tipo.legenda, color: colors.teal },
  statusTexto: { ...tipo.secao, color: colors.text, marginTop: 2 },
  secao: { ...tipo.destaque, color: colors.text, marginTop: 4 },
});
