import { Stack } from 'expo-router';

import { GuardGrupo } from '@/componentes/GuardGrupo';

export default function EmpresaLayout() {
  return (
    <GuardGrupo grupo="empresa">
      <Stack />
    </GuardGrupo>
  );
}
