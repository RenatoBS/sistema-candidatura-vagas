import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, tipo } from './tokens';

interface CabecalhoProps {
  titulo: string;
  subtitulo?: string;
  voltar?: boolean;
}

export function Cabecalho({ titulo, subtitulo, voltar = false }: CabecalhoProps) {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <View style={styles.bloco}>
      {voltar ? (
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => {
            if (router.canGoBack()) router.back();
          }}
          style={styles.voltar}
        >
          <Ionicons name="chevron-back" size={20} color={colors.primary} />
          <Text style={styles.voltarTexto}>{t('comum.voltar')}</Text>
        </Pressable>
      ) : null}
      <Text style={styles.titulo}>{titulo}</Text>
      {subtitulo ? <Text style={styles.subtitulo}>{subtitulo}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bloco: { gap: spacing.xs, marginBottom: spacing.sm },
  titulo: { ...tipo.secao, color: colors.text },
  subtitulo: { ...tipo.corpo, color: colors.textMuted },
  voltar: { flexDirection: 'row', alignItems: 'center', minHeight: 44, alignSelf: 'flex-start' },
  voltarTexto: { ...tipo.destaque, color: colors.primary },
});
