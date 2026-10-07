import { Switch, Text, View } from 'react-native';

import { estilos } from './estilos';
import { colors } from './tokens';

interface LinhaInterruptorProps {
  label: string;
  value: boolean;
  onValueChange: (valor: boolean) => void;
}

export function LinhaInterruptor({ label, value, onValueChange }: LinhaInterruptorProps) {
  return (
    <View style={estilos.linha}>
      <Text style={[estilos.corpo, styles.flex]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: colors.primary }}
      />
    </View>
  );
}

const styles = { flex: { flex: 1 } };
