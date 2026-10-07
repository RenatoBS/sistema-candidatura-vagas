import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';

import { CamposAcaoAdmin } from '@/admin/CamposAcaoAdmin';
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

interface ItemFila {
  id: string;
  nomeFantasia: string;
  statusVerificacao: string;
}

export default function FilaVerificacaoScreen() {
  const { t } = useTranslation();
  const { accessToken } = useAuth();
  const consulta = useConsulta(['fila'], () => api<ItemFila[]>('/admin/empresas/fila', {}, accessToken), null);
  const acao = useAcaoAdmin(() => consulta.refetch());
  const itens = consulta.data ?? [];

  return (
    <Tela teclado>
      <Cabecalho titulo={t('admin.fila')} voltar />
      <CamposAcaoAdmin acao={acao} />
      {consulta.isLoading ? <EstadoVazio titulo={t('comum.carregando')} /> : null}
      {consulta.isError ? <EstadoVazio titulo={t('comum.erroCarregar')} /> : null}
      {!consulta.isLoading && !consulta.isError && itens.length === 0 ? <EstadoVazio titulo={t('admin.vazia')} /> : null}
      {itens.map((item) => (
        <Cartao key={item.id}>
          <Text style={estilos.tituloItem}>{item.nomeFantasia}</Text>
          <Text style={estilos.mudo}>{t(`admin.statusEmpresa.${item.statusVerificacao}`, { defaultValue: item.statusVerificacao })}</Text>
          <Button label={t('admin.aprovar')} desabilitado={acao.ocupado} onPress={() => void acao.executar(item.id, 'aprovar')} />
          <Button
            label={t('admin.rejeitar')}
            variante="perigo"
            desabilitado={acao.ocupado}
            onPress={() => void acao.executar(item.id, 'rejeitar')}
          />
        </Cartao>
      ))}
    </Tela>
  );
}
