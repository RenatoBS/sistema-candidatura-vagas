import { useRouter } from 'expo-router';
import { useEffect, type PropsWithChildren } from 'react';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';

import { podeAcessarGrupo, type GrupoRota } from '@/auth/acesso';
import { useAuth } from '@/auth/AuthContext';

export function GuardGrupo({ grupo, children }: PropsWithChildren<{ grupo: GrupoRota }>) {
  const { sessao, pronto } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();
  const decisao = podeAcessarGrupo(sessao, grupo);

  useEffect(() => {
    if (pronto && !decisao.ok) router.replace(decisao.redirecionar);
  }, [decisao.ok, decisao.redirecionar, pronto, router]);

  if (!pronto || !decisao.ok) return <Text>{t('comum.carregando')}</Text>;
  return children;
}
