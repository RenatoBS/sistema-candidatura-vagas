import { Stack } from 'expo-router';

import { GuardGrupo } from '@/componentes/GuardGrupo';
import { colors } from '@/design-system/tokens';

export default function AdminLayout() {
  return (
    <GuardGrupo grupo="admin">
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
    </GuardGrupo>
  );
}
