import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text } from 'react-native';

import { api } from '@/api/cliente';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/design-system/Button';
import { Cabecalho } from '@/design-system/Cabecalho';
import { Cartao } from '@/design-system/Cartao';
import { Chip } from '@/design-system/Chip';
import { estilos } from '@/design-system/estilos';
import { Tela } from '@/design-system/Tela';
import { useConsulta } from '@/hooks/useConsulta';
import { usePermissao } from '@/hooks/usePermissao';

interface StatusWhatsapp {
  status: string | null;
  numero: string | null;
  ultimaConexaoEm: string | null;
  qrcode?: string | null;
}

export default function WhatsappEmpresaScreen() {
  const { t } = useTranslation();
  const { sessao, accessToken } = useAuth();
  const empresaId = sessao?.empresaAtivaId ?? sessao?.empresas[0]?.empresaId ?? '';
  const podeConectar = usePermissao('conectar_whatsapp', empresaId);
  const consulta = useConsulta(
    ['whatsapp'],
    () => api<StatusWhatsapp>(`/empresas/${empresaId}/whatsapp/status`, {}, accessToken),
    empresaId,
  );
  const [qr, setQr] = useState<string | null>(null);

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
      <Cartao>
        {status ? <Chip texto={status} /> : null}
        <Text style={estilos.corpo}>
          {t('whatsapp.numero')}: {consulta.data?.numero ?? t('whatsapp.semNumero')}
        </Text>
        <Text style={estilos.mudo}>
          {t('whatsapp.ultima')}: {consulta.data?.ultimaConexaoEm ?? t('whatsapp.semConexao')}
        </Text>
        {imagem ? <Image source={{ uri: imagem }} style={styles.qr} accessibilityLabel={t('whatsapp.qr')} /> : null}
        {qr && !imagem ? (
          <Text style={estilos.mudo}>
            {t('whatsapp.qr')}: {qr}
          </Text>
        ) : null}
      </Cartao>
      {podeConectar ? <Button label={t('whatsapp.criar')} onPress={() => void criar()} /> : null}
      {podeConectar ? <Button label={t('whatsapp.conectar')} variante="secundario" onPress={() => void conectar()} /> : null}
      <Button label={t('whatsapp.atualizar')} variante="texto" onPress={() => void consulta.refetch()} />
    </Tela>
  );
}

const styles = StyleSheet.create({
  qr: { width: 220, height: 220, alignSelf: 'center' },
});
