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

interface EmpresaItem {
  id: string;
  nomeFantasia: string;
  statusVerificacao: string;
}

export default function EmpresasAdminScreen() {
  const { t } = useTranslation();
  const { accessToken } = useAuth();
  const consulta = useConsulta(['empresas-admin'], () => api<EmpresaItem[]>('/admin/empresas', {}, accessToken), null);
  const empresas = consulta.data ?? [];

  return (
    <Tela>
      <Cabecalho titulo={t('admin.empresas')} voltar />
      {consulta.isLoading ? <EstadoVazio titulo={t('comum.carregando')} /> : null}
      {!consulta.isLoading && empresas.length === 0 ? <EstadoVazio titulo={t('admin.vazia')} /> : null}
      {empresas.map((empresa) => (
        <Cartao key={empresa.id}>
          <Text style={estilos.tituloItem}>{empresa.nomeFantasia}</Text>
          <Text style={estilos.mudo}>{empresa.statusVerificacao}</Text>
        </Cartao>
      ))}
    </Tela>
  );
}
