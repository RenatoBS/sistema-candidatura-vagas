import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/cliente';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/design-system/Button';
import { colors, spacing } from '@/design-system/tokens';
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
    const resposta = await api<StatusWhatsapp>(
      `/empresas/${empresaId}/whatsapp/conectar`,
      { method: 'POST' },
      accessToken,
    );
    setQr(resposta.qrcode ?? null);
    await consulta.refetch();
  }

  const status = consulta.data?.status;
  const imagem = qr?.startsWith('data:image') ? qr : null;

  return (
    <View style={styles.tela}>
      <Text style={styles.titulo}>{t('whatsapp.titulo')}</Text>
      <Text style={styles.texto}>{status ?? '—'}</Text>
      <Text style={styles.texto}>
        {t('whatsapp.numero')}: {consulta.data?.numero ?? t('whatsapp.semNumero')}
      </Text>
      <Text style={styles.texto}>
        {t('whatsapp.ultima')}: {consulta.data?.ultimaConexaoEm ?? t('whatsapp.semConexao')}
      </Text>
      {podeConectar ? <Button label={t('whatsapp.criar')} onPress={() => void criar()} /> : null}
      {podeConectar ? <Button label={t('whatsapp.conectar')} onPress={() => void conectar()} /> : null}
      <Button label={t('whatsapp.atualizar')} onPress={() => void consulta.refetch()} />
      {imagem ? <Image source={{ uri: imagem }} style={styles.qr} /> : null}
      {qr && !imagem ? <Text style={styles.texto}>{t('whatsapp.qr')}: {qr}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, padding: spacing.lg, backgroundColor: colors.background, gap: spacing.sm },
  titulo: { fontSize: 22, fontWeight: '700', color: colors.text },
  texto: { color: colors.text },
  qr: { width: 220, height: 220, marginTop: spacing.md },
});
