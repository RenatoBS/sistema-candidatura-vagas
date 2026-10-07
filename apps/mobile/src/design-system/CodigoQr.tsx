import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors } from './tokens';
import { matrizQr } from '@/auth/qr';


interface CodigoQrProps {
  valor: string;
  /** Lado do QR em pontos (sem a margem). */
  tamanho?: number;
  accessibilityLabel: string;
}

/** QR code desenhado com Views (sem módulo nativo): funciona igual no web, iOS e Android. */
export function CodigoQr({ valor, tamanho = 192, accessibilityLabel }: CodigoQrProps) {
  const matriz = useMemo(() => matrizQr(valor), [valor]);
  const modulo = tamanho / matriz.length;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel} style={styles.moldura}>
      {matriz.map((linha, indice) => (
        <View key={indice} style={styles.linha}>
          {linha.map((escuro, coluna) => (
            <View key={coluna} style={{ width: modulo, height: modulo, backgroundColor: escuro ? '#000000' : '#FFFFFF' }} />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // Margem branca ("quiet zone") para os leitores, mesmo em tema escuro.
  moldura: { alignSelf: 'center', backgroundColor: '#FFFFFF', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  linha: { flexDirection: 'row' },
});
