import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';

import { Banner } from '@/design-system/Banner';
import { Campo } from '@/design-system/Campo';
import { Cartao } from '@/design-system/Cartao';
import { estilos } from '@/design-system/estilos';

import type { useAcaoAdmin } from './useAcaoAdmin';

export function CamposAcaoAdmin({ acao }: { acao: ReturnType<typeof useAcaoAdmin> }) {
  const { t } = useTranslation();
  return (
    <Cartao>
      <Text style={estilos.legenda}>{t('admin.acaoAjuda')}</Text>
      {acao.erro ? <Banner tipo="erro" texto={acao.erro} /> : null}
      {acao.sucesso ? <Banner tipo="ok" texto={acao.sucesso} /> : null}
      <Campo label={t('admin.motivo')} value={acao.motivo} onChangeText={acao.setMotivo} />
      <Campo label={t('admin.senha')} value={acao.senha} onChangeText={acao.setSenha} secureTextEntry autoCapitalize="none" />
    </Cartao>
  );
}
