import { useRouter } from 'expo-router';
import { useEffect, type PropsWithChildren } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { podeAcessarGrupo, type GrupoRota } from '@/auth/acesso';
import { useAuth } from '@/auth/AuthContext';
import { colors, tipo } from '@/design-system/tokens';

export function GuardGrupo({ grupo, children }: PropsWithChildren<{ grupo: GrupoRota }>) {
  const { sessao, pronto } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();
  const decisao = podeAcessarGrupo(sessao, grupo);

  useEffect(() => {
    if (pronto && !decisao.ok) router.replace(decisao.redirecionar);
  }, [decisao.ok, decisao.redirecionar, pronto, router]);

  if (!pronto || !decisao.ok) {
    return (
      <View style={styles.espera}>
        <Text style={styles.texto}>{t('comum.carregando')}</Text>
      </View>
    );
  }
  return children;
}

const styles = StyleSheet.create({
  espera: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  texto: { ...tipo.corpo, color: colors.textMuted },
});
