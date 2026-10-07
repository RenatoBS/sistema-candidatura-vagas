import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';

import { api } from '@/api/cliente';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/design-system/Button';
import { Cabecalho } from '@/design-system/Cabecalho';
import { Campo } from '@/design-system/Campo';
import { Cartao } from '@/design-system/Cartao';
import { estilos } from '@/design-system/estilos';
import { Tela } from '@/design-system/Tela';
import { useConsulta } from '@/hooks/useConsulta';

interface EmpresaResumo {
  id: string;
  statusVerificacao: string;
  registroDns: string;
  exigeRevisaoManual: boolean;
}

export default function VerificacaoScreen() {
  const { t } = useTranslation();
  const { sessao, accessToken } = useAuth();
  const empresaId = sessao?.empresaAtivaId ?? sessao?.empresas[0]?.empresaId ?? '';
  const [codigo, setCodigo] = useState('');
  const consulta = useConsulta(['verificacao'], () => api<EmpresaResumo>(`/empresas/${empresaId}`, {}, accessToken), empresaId);

  return (
    <Tela teclado>
      <Cabecalho titulo={t('empresa.status')} voltar />
      <Cartao>
        <Text style={estilos.tituloItem}>{consulta.data?.statusVerificacao ?? '—'}</Text>
        <Text style={estilos.mudo}>
          {t('empresa.dns')}: {consulta.data?.registroDns ?? '—'}
        </Text>
      </Cartao>
      <Campo label={t('empresa.codigoEmail')} value={codigo} onChangeText={setCodigo} autoCapitalize="none" />
      <Button
        label={t('empresa.confirmarEmail')}
        onPress={() =>
          void api(
            `/empresas/${empresaId}/verificacao/email`,
            { method: 'POST', body: JSON.stringify({ codigo }) },
            accessToken,
          ).then(() => consulta.refetch())
        }
      />
      <Button
        label={t('empresa.confirmarDns')}
        variante="secundario"
        onPress={() =>
          void api(`/empresas/${empresaId}/verificacao/dominio`, { method: 'POST' }, accessToken).then(() => consulta.refetch())
        }
      />
    </Tela>
  );
}
