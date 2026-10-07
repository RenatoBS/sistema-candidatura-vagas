import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/design-system/Button';

export function BotaoSair() {
  const { t } = useTranslation();
  const { sair } = useAuth();
  const router = useRouter();
  return (
    <Button
      label={t('comum.sair')}
      variante="texto"
      onPress={() => {
        void sair().then(() => router.replace('/'));
      }}
    />
  );
}
