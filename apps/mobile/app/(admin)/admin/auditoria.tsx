import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';

import { api } from '@/api/cliente';
import { useAuth } from '@/auth/AuthContext';
import { Cabecalho } from '@/design-system/Cabecalho';
import { Cartao } from '@/design-system/Cartao';
import { EstadoVazio } from '@/design-system/EstadoVazio';
import { estilos } from '@/design-system/estilos';
import { Tela } from '@/design-system/Tela';
import { useConsulta } from '@/hooks/useConsulta';

interface Evento {
  id: string;
  acao: string;
  recursoTipo: string;
  motivo: string | null;
  criadoEm: string;
}

export default function AuditoriaScreen() {
  const { t } = useTranslation();
  const { accessToken } = useAuth();
  const consulta = useConsulta(['auditoria'], () => api<Evento[]>('/admin/auditoria', {}, accessToken), null);
  const eventos = consulta.data ?? [];

  return (
    <Tela>
      <Cabecalho titulo={t('admin.auditoria')} voltar />
      {consulta.isLoading ? <EstadoVazio titulo={t('comum.carregando')} /> : null}
      {!consulta.isLoading && eventos.length === 0 ? <EstadoVazio titulo={t('admin.vazia')} /> : null}
      {eventos.map((evento) => (
        <Cartao key={evento.id}>
          <Text style={estilos.tituloItem}>{evento.acao}</Text>
          <Text style={estilos.mudo}>
            {evento.recursoTipo} · {evento.motivo ?? '—'}
          </Text>
        </Cartao>
      ))}
    </Tela>
  );
}
