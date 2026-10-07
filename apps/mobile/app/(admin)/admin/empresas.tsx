import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';

import { CamposAcaoAdmin } from '@/admin/CamposAcaoAdmin';
import { acoesDaEmpresa } from '@/admin/regras';
import { useAcaoAdmin } from '@/admin/useAcaoAdmin';
import { api } from '@/api/cliente';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/design-system/Button';
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
  const acao = useAcaoAdmin(() => consulta.refetch());
  const empresas = consulta.data ?? [];
  const temAcoes = empresas.some((empresa) => acoesDaEmpresa(empresa.statusVerificacao).length > 0);

  return (
    <Tela teclado>
      <Cabecalho titulo={t('admin.empresas')} voltar />
      {temAcoes ? <CamposAcaoAdmin acao={acao} /> : null}
      {consulta.isLoading ? <EstadoVazio titulo={t('comum.carregando')} /> : null}
      {consulta.isError ? <EstadoVazio titulo={t('comum.erroCarregar')} /> : null}
      {!consulta.isLoading && !consulta.isError && empresas.length === 0 ? <EstadoVazio titulo={t('admin.vazia')} /> : null}
      {empresas.map((empresa) => (
        <Cartao key={empresa.id}>
          <Text style={estilos.tituloItem}>{empresa.nomeFantasia}</Text>
          <Text style={estilos.mudo}>
            {t(`admin.statusEmpresa.${empresa.statusVerificacao}`, { defaultValue: empresa.statusVerificacao })}
          </Text>
          {acoesDaEmpresa(empresa.statusVerificacao).map((caminho) => (
            <Button
              key={caminho}
              label={t(`admin.${caminho}`)}
              variante={caminho === 'suspender' ? 'perigo' : 'primario'}
              desabilitado={acao.ocupado}
              onPress={() => void acao.executar(empresa.id, caminho)}
            />
          ))}
        </Cartao>
      ))}
    </Tela>
  );
}
