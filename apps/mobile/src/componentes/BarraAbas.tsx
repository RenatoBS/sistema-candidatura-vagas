import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing, tipo } from '@/design-system/tokens';
import { ABAS, abaAtiva, type GrupoAbas } from '@/navegacao/abas';

const ICONES = {
  vagas: 'briefcase-outline',
  candidaturas: 'documents-outline',
  notificacoes: 'notifications-outline',
  perfil: 'person-outline',
  empresa: 'business-outline',
} as const;

export function BarraAbas({ grupo }: { grupo: GrupoAbas }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const ativa = abaAtiva(grupo, pathname);

  return (
    <View style={[styles.barra, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      {ABAS[grupo].map((aba) => {
        const selecionada = aba.id === ativa;
        return (
          <Pressable
            key={aba.id}
            accessibilityRole="button"
            accessibilityState={{ selected: selecionada }}
            onPress={() => router.push(aba.href)}
            style={styles.item}
          >
            <Ionicons name={ICONES[aba.icone]} size={22} color={selecionada ? colors.primary : colors.textMuted} />
            <Text style={[styles.rotulo, selecionada ? styles.rotuloAtivo : null]}>{t(aba.rotuloKey)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  barra: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    paddingTop: spacing.sm,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xs, minHeight: 48 },
  rotulo: { ...tipo.legenda, color: colors.textMuted },
  rotuloAtivo: { color: colors.primary },
});
