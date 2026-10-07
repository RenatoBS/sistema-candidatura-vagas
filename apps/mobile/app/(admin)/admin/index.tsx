import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { BotaoSair } from '@/componentes/BotaoSair';
import { TrocaVisao } from '@/componentes/TrocaVisao';
import { Cabecalho } from '@/design-system/Cabecalho';
import { ItemLista } from '@/design-system/ItemLista';
import { Tela } from '@/design-system/Tela';
import { colors, radius, tipo } from '@/design-system/tokens';

export default function AdminHome() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <Tela>
      <Cabecalho titulo={t('admin.titulo')} subtitulo="Revise atividades e mantenha a plataforma confiável." />
      <View style={styles.alerta}><Text style={styles.alertaTitulo}>Painel protegido</Text><Text style={styles.alertaTexto}>Toda ação administrativa fica registrada na auditoria.</Text></View>
      <Text style={styles.secao}>Operação</Text>
      <ItemLista titulo={t('admin.fila')} detalhe="Solicitações aguardando decisão" icone="time-outline" onPress={() => router.push('/admin/verificacoes')} />
      <ItemLista titulo={t('admin.empresas')} detalhe="Cadastros e situação das empresas" icone="business-outline" onPress={() => router.push('/admin/empresas')} />
      <Text style={styles.secao}>Monitoramento</Text>
      <ItemLista titulo={t('admin.auditoria')} detalhe="Histórico de ações da plataforma" icone="receipt-outline" onPress={() => router.push('/admin/auditoria')} />
      <ItemLista titulo={t('admin.whatsapp')} detalhe="Status das instâncias conectadas" icone="logo-whatsapp" onPress={() => router.push('/admin/whatsapp')} />
      <TrocaVisao />
      <BotaoSair />
    </Tela>
  );
}

const styles = StyleSheet.create({
  alerta: { padding: 18, borderRadius: radius.lg, backgroundColor: colors.primarySoft, gap: 3 },
  alertaTitulo: { ...tipo.destaque, color: colors.primaryStrong },
  alertaTexto: { ...tipo.legenda, color: colors.textMuted },
  secao: { ...tipo.destaque, color: colors.text, marginTop: 4 },
});
