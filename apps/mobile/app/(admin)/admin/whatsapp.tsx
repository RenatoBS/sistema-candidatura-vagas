import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';

import { api } from '@/api/cliente';
import { useAuth } from '@/auth/AuthContext';
import { Banner } from '@/design-system/Banner';
import { Cabecalho } from '@/design-system/Cabecalho';
import { Cartao } from '@/design-system/Cartao';
import { Chip } from '@/design-system/Chip';
import { EstadoVazio } from '@/design-system/EstadoVazio';
import { estilos } from '@/design-system/estilos';
import { Tela } from '@/design-system/Tela';
import { formatarDataHora } from '@/formatacao/data';
import { useConsulta } from '@/hooks/useConsulta';

interface Instancia {
  id: string;
  nomeFantasia: string | null;
  status: string;
  numero: string | null;
  ultimaConexaoEm: string | null;
}

export default function WhatsappAdminScreen() {
  const { t } = useTranslation();
  const { accessToken } = useAuth();
  const consulta = useConsulta(['whatsapp-admin'], () => api<Instancia[]>('/admin/whatsapp/instancias', {}, accessToken), null);
  const instancias = consulta.data ?? [];

  return (
    <Tela>
      <Cabecalho titulo={t('admin.whatsapp')} voltar />
      {consulta.isLoading ? <EstadoVazio titulo={t('comum.carregando')} /> : null}
      {consulta.isError ? <EstadoVazio titulo={t('comum.erroCarregar')} /> : null}
      {!consulta.isLoading && !consulta.isError && instancias.length === 0 ? <EstadoVazio titulo={t('admin.vazia')} /> : null}
      {instancias.map((instancia) => (
        <Cartao key={instancia.id}>
          <Text style={estilos.tituloItem}>{instancia.nomeFantasia ?? '—'}</Text>
          <Chip texto={instancia.status} />
          <Text style={estilos.mudo}>
            {t('whatsapp.numero')}: {instancia.numero ?? t('whatsapp.semNumero')}
          </Text>
          <Text style={estilos.mudo}>
            {t('whatsapp.ultima')}: {formatarDataHora(instancia.ultimaConexaoEm) ?? t('whatsapp.semConexao')}
          </Text>
          {instancia.status !== 'CONECTADA' ? <Banner tipo="aviso" texto={t('whatsapp.banner')} /> : null}
        </Cartao>
      ))}
    </Tela>
  );
}
