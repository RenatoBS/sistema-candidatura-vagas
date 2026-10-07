import { Link, useLocalSearchParams } from 'expo-router';
import { Text, View, StyleSheet } from 'react-native';
import { colors, spacing } from '@/design-system/tokens';

export default function DetalheVagaEmpresa() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <View style={styles.tela}>
      <Text style={styles.titulo}>Detalhes da vaga</Text>
      <Link href={`/empresa/vagas/${id}/candidatos`} style={styles.link}>
        Ver candidatos da vaga
      </Link>
      <Link href={`/empresa/vagas/${id}/sugestoes`} style={styles.link}>
        Ver sugestões de match
      </Link>
    </View>
  );
}
const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background, padding: spacing.lg, gap: spacing.md },
  titulo: { color: colors.text, fontSize: 22, fontWeight: '700' },
  link: { color: colors.primary, fontSize: 16 },
});
