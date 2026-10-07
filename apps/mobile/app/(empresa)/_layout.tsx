import { Stack, usePathname } from 'expo-router';
import { View } from 'react-native';

import { BarraAbas } from '@/componentes/BarraAbas';
import { GuardGrupo } from '@/componentes/GuardGrupo';
import { colors } from '@/design-system/tokens';
import { barraVisivel } from '@/navegacao/abas';

export default function EmpresaLayout() {
  const pathname = usePathname();
  const visivel = barraVisivel('empresa', pathname);

  return (
    <GuardGrupo grupo="empresa">
      <View style={estilo}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
        {visivel ? <BarraAbas grupo="empresa" /> : null}
      </View>
    </GuardGrupo>
  );
}

const estilo = { flex: 1, backgroundColor: colors.background };
