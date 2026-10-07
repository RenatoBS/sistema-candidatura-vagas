import { Stack, usePathname } from 'expo-router';
import { View } from 'react-native';

import { BarraAbas } from '@/componentes/BarraAbas';
import { GuardGrupo } from '@/componentes/GuardGrupo';
import { colors } from '@/design-system/tokens';
import { barraVisivel } from '@/navegacao/abas';

export default function CandidatoLayout() {
  const pathname = usePathname();
  const visivel = barraVisivel('candidato', pathname);

  return (
    <GuardGrupo grupo="candidato">
      <View style={estilo}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
        {visivel ? <BarraAbas grupo="candidato" /> : null}
      </View>
    </GuardGrupo>
  );
}

const estilo = { flex: 1, backgroundColor: colors.background };
