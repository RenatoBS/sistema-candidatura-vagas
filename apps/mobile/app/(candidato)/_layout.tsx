import { Stack } from 'expo-router';

import { GuardGrupo } from '@/componentes/GuardGrupo';

export default function CandidatoLayout() {
  return (
    <GuardGrupo grupo="candidato">
      <Stack />
    </GuardGrupo>
  );
}
