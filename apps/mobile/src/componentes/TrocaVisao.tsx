import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/cliente';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/design-system/Button';
import { estilos } from '@/design-system/estilos';
import { spacing } from '@/design-system/tokens';

export function TrocaVisao() {
  const { sessao, accessToken, entrar } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
  if (!sessao) return null;

  async function trocar(visao: 'CANDIDATO' | 'EMPRESA' | 'ADMIN') {
    const resposta = await api<{ accessToken: string; perfil: typeof sessao }>(
      '/me/visao',
      { method: 'PATCH', body: JSON.stringify({ visao, empresaId: sessao?.empresaAtivaId ?? undefined }) },
      accessToken,
    );
    if (resposta.perfil) await entrar({ accessToken: resposta.accessToken, refreshToken: '' }, resposta.perfil);
    if (visao === 'CANDIDATO') router.replace('/candidato');
    if (visao === 'EMPRESA') router.replace('/empresa');
    if (visao === 'ADMIN') router.replace('/admin');
  }

  const podeEmpresa = sessao.empresas.length > 0;
  const podeAdmin = sessao.papeisGlobais.includes('ADMIN_PLATAFORMA');
  if (!sessao.ehCandidato && !podeEmpresa && !podeAdmin) return null;

  return (
    <View style={styles.grupo}>
      <Text style={estilos.legenda}>{t('visao.trocar')}</Text>
      {sessao.ehCandidato ? <Button label={t('visao.candidato')} variante="secundario" onPress={() => void trocar('CANDIDATO')} /> : null}
      {podeEmpresa ? <Button label={t('visao.empresa')} variante="secundario" onPress={() => void trocar('EMPRESA')} /> : null}
      {podeAdmin ? <Button label={t('visao.admin')} variante="secundario" onPress={() => void trocar('ADMIN')} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  grupo: { gap: spacing.sm },
});
