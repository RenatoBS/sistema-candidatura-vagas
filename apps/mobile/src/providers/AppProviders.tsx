import { PropsWithChildren } from 'react';
import { I18nextProvider } from 'react-i18next';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { i18n } from '@/i18n';

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <SafeAreaProvider>
      <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
    </SafeAreaProvider>
  );
}
