import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text } from 'react-native';

import { api, ErroApi } from '@/api/cliente';
import { useAuth } from '@/auth/AuthContext';
import { Banner } from '@/design-system/Banner';
import { Button } from '@/design-system/Button';
import { Cabecalho } from '@/design-system/Cabecalho';
import { Cartao } from '@/design-system/Cartao';
import { Chip } from '@/design-system/Chip';
import { estilos } from '@/design-system/estilos';
import { Tela } from '@/design-system/Tela';
import { formatarDataHora } from '@/formatacao/data';
import { useConsulta } from '@/hooks/useConsulta';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';
import { usePermissao } from '@/hooks/usePermissao';

interface StatusWhatsapp {
  status: string | null;
  numero: string | null;
  ultimaConexaoEm: string | null;
  qrcode?: string | null;
}

export default function WhatsappEmpresaScreen() {
  const { t } = useTranslation();
  const { accessToken } = useAuth();
  const empresaId = useEmpresaAtiva();
  const podeConectar = usePermissao('conectar_whatsapp', empresaId);
  const consulta = useConsulta(
    ['whatsapp'],
    () => api<StatusWhatsapp>(`/empresas/${empresaId}/whatsapp/status`, {}, accessToken),
    empresaId,
  );
  const [qr, setQr] = useState<string | null>(null);
  const [erro, setErro] = useState('');

  async function agir(fn: () => Promise<void>) {
    setErro('');
    try {
      await fn();
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : t('comum.erro'));
    }
  }

  async function criar() {
    await api(`/empresas/${empresaId}/whatsapp/instancia`, { method: 'POST' }, accessToken);
    await consulta.refetch();
  }

  async function conectar() {
    const resposta = await api<StatusWhatsapp>(`/empresas/${empresaId}/whatsapp/conectar`, { method: 'POST' }, accessToken);
    setQr(resposta.qrcode ?? null);
    await consulta.refetch();
  }

  const status = consulta.data?.status;
  const imagem = qr?.startsWith('data:image') ? qr : null;

  return (
    <Tela>
      <Cabecalho titulo={t('whatsapp.titulo')} voltar />
      {erro ? <Banner tipo="erro" texto={erro} /> : null}
      {consulta.isLoading ? <Text style={estilos.mudo}>{t('comum.carregando')}</Text> : null}
      {consulta.isError ? <Banner tipo="erro" texto={t('comum.erroCarregar')} /> : null}
      <Cartao>
        {status ? <Chip texto={status} /> : null}
        <Text style={estilos.corpo}>
          {t('whatsapp.numero')}: {consulta.data?.numero ?? t('whatsapp.semNumero')}
        </Text>
        <Text style={estilos.mudo}>
          {t('whatsapp.ultima')}: {formatarDataHora(consulta.data?.ultimaConexaoEm) ?? t('whatsapp.semConexao')}
        </Text>
        {imagem ? <Image source={{ uri: imagem }} style={styles.qr} accessibilityLabel={t('whatsapp.qr')} /> : null}
        {qr && !imagem ? (
          <Text style={estilos.mudo}>
            {t('whatsapp.qr')}: {qr}
          </Text>
        ) : null}
      </Cartao>
      {podeConectar ? <Button label={t('whatsapp.criar')} onPress={() => void agir(criar)} /> : null}
      {podeConectar ? <Button label={t('whatsapp.conectar')} variante="secundario" onPress={() => void agir(conectar)} /> : null}
      <Button label={t('whatsapp.atualizar')} variante="texto" onPress={() => void consulta.refetch()} />
    </Tela>
  );
}

const styles = StyleSheet.create({
  qr: { width: 220, height: 220, alignSelf: 'center' },
});
