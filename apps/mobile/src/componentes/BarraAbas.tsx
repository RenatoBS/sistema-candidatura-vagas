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
            <View style={[styles.icone, selecionada ? styles.iconeAtivo : null]}>
              <Ionicons name={ICONES[aba.icone]} size={21} color={selecionada ? colors.primary : colors.textMuted} />
            </View>
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
    paddingTop: 6,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 1, minHeight: 52 },
  icone: { width: 38, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  iconeAtivo: { backgroundColor: colors.primarySoft },
  rotulo: { ...tipo.legenda, fontSize: 11, lineHeight: 15, color: colors.textMuted },
  rotuloAtivo: { color: colors.primary },
});
