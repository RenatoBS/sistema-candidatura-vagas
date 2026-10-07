import type { NotificacoesResponse } from '@scv/contracts';
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/cliente';
import { useAuth } from '@/auth/AuthContext';
import { TrocaVisao } from '@/componentes/TrocaVisao';
import { colors, spacing } from '@/design-system/tokens';
import { useConsulta } from '@/hooks/useConsulta';
import { usePermissao } from '@/hooks/usePermissao';

interface EmpresaResumo {
  statusVerificacao: string;
  nomeFantasia: string;
}

export default function EmpresaHome() {
  const { t } = useTranslation();
  const { sessao, accessToken } = useAuth();
  const empresaId = sessao?.empresaAtivaId ?? sessao?.empresas[0]?.empresaId;
  const podeMembros = usePermissao('gerenciar_membros', empresaId);
  const empresa = useConsulta(
    ['empresa'],
    () => api<EmpresaResumo>(`/empresas/${empresaId}`, {}, accessToken),
    empresaId,
  );
  const notificacoes = useConsulta<NotificacoesResponse>(['notificacoes'], () =>
    api('/notificacoes', {}, accessToken),
  );

  return (
    <View style={styles.tela}>
      <Text style={styles.titulo}>{empresa.data?.nomeFantasia ?? t('empresa.titulo')}</Text>
      <Text style={styles.texto}>
        {t('empresa.status')}: {empresa.data?.statusVerificacao ?? '—'}
      </Text>
      <Link href="/empresa/verificacao">{t('empresa.status')}</Link>
      <Link href="/empresa/whatsapp">{t('empresa.whatsapp')}</Link>
      <Link href="/empresa/vagas">{t('empresa.vagas')}</Link>
      <Link href="/empresa/notificacoes">
        Central de notificações ({notificacoes.data?.naoLidas ?? 0} não lidas)
      </Link>
      <Link href="/empresa/notificacoes-preferencias">Preferências de notificações</Link>
      {podeMembros ? <Link href="/empresa/membros">{t('empresa.membros')}</Link> : null}
      <TrocaVisao />
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, padding: spacing.lg, backgroundColor: colors.background, gap: spacing.sm },
  titulo: { fontSize: 22, fontWeight: '700', color: colors.text },
  texto: { color: colors.text },
});
