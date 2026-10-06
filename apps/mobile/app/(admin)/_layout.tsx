import { Stack } from 'expo-router';

import { GuardGrupo } from '@/componentes/GuardGrupo';

export default function AdminLayout() {
  return (
    <GuardGrupo grupo="admin">
      <Stack />
    </GuardGrupo>
  );
}
