import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';

import { TrocaVisao } from '@/componentes/TrocaVisao';
import { Cabecalho } from '@/design-system/Cabecalho';
import { estilos } from '@/design-system/estilos';
import { ItemLista } from '@/design-system/ItemLista';
import { Tela } from '@/design-system/Tela';

export default function AdminHome() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <Tela>
      <Cabecalho titulo={t('admin.titulo')} />
      <ItemLista titulo={t('admin.fila')} onPress={() => router.push('/admin/verificacoes')} />
      <ItemLista titulo={t('admin.empresas')} onPress={() => router.push('/admin/empresas')} />
      <ItemLista titulo={t('admin.auditoria')} onPress={() => router.push('/admin/auditoria')} />
      <ItemLista titulo={t('admin.whatsapp')} onPress={() => router.push('/admin/whatsapp')} />
      <Text style={estilos.legenda}>{t('visao.trocar')}</Text>
      <TrocaVisao />
    </Tela>
  );
}
