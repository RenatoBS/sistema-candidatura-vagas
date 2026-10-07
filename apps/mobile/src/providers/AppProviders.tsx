import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type PropsWithChildren } from 'react';
import { I18nextProvider } from 'react-i18next';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { deveRepetir } from '@/api/repeticao';
import { AuthProvider } from '@/auth/AuthContext';
import { i18n } from '@/i18n';

export function AppProviders({ children }: PropsWithChildren) {
  const [cliente] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: deveRepetir } } }));
  return (
    <SafeAreaProvider>
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={cliente}>
          <AuthProvider>{children}</AuthProvider>
        </QueryClientProvider>
      </I18nextProvider>
    </SafeAreaProvider>
  );
}
