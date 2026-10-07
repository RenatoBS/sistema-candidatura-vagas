import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/cliente';
import { Button } from '@/design-system/Button';
import { Marca } from '@/design-system/Marca';
import { Tela } from '@/design-system/Tela';
import { colors, radius, spacing, tipo } from '@/design-system/tokens';

export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [simulador, setSimulador] = useState(false);

  useEffect(() => {
    void api<{ ativo: boolean }>('/dev/simulador/status')
      .then(() => setSimulador(true))
      .catch(() => setSimulador(false));
  }, []);

  return (
    <Tela centralizar rolar={false}>
      <View style={styles.topo}>
        <Marca />
        <View style={styles.hero}>
          <View style={styles.ornamentoUm} />
          <View style={styles.ornamentoDois} />
          <View style={styles.iconeHero}><Ionicons name="rocket-outline" size={32} color={colors.onPrimary} /></View>
          <Text style={styles.titulo}>Seu próximo passo{`\n`}começa aqui.</Text>
          <Text style={styles.subtitulo}>{t('home.subtitle')}</Text>
        </View>
        <View style={styles.beneficios}>
          <Ionicons name="shield-checkmark-outline" size={18} color={colors.teal} />
          <Text style={styles.fase}>Um processo claro, seguro e pensado para pessoas.</Text>
        </View>
      </View>
      <View style={styles.acoes}>
        <Button label={t('home.entrar')} onPress={() => router.push('/login')} />
        <Button label={t('home.cadastrar')} variante="secundario" onPress={() => router.push('/cadastro')} />
        {simulador ? (
          <Button label={t('simulador.abrir')} variante="texto" onPress={() => router.push('/dev/simulador-whatsapp')} />
        ) : null}
      </View>
    </Tela>
  );
}

const styles = StyleSheet.create({
  topo: { gap: spacing.xl },
  hero: { overflow: 'hidden', backgroundColor: colors.primary, padding: spacing.lg, paddingTop: 28, paddingBottom: 30, borderRadius: radius.xl, gap: spacing.md },
  ornamentoUm: { position: 'absolute', width: 210, height: 210, borderRadius: 105, backgroundColor: '#FFFFFF', opacity: 0.09, right: -78, top: -80 },
  ornamentoDois: { position: 'absolute', width: 110, height: 110, borderRadius: 55, backgroundColor: '#AEB9FF', opacity: 0.2, right: 30, bottom: -68 },
  iconeHero: { width: 54, height: 54, borderRadius: 18, backgroundColor: '#FFFFFF26', justifyContent: 'center', alignItems: 'center' },
  titulo: { ...tipo.titulo, color: colors.onPrimary, fontSize: 31, lineHeight: 37 },
  subtitulo: { ...tipo.corpo, color: '#E7EAFE', maxWidth: 285 },
  beneficios: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', paddingHorizontal: spacing.xs },
  fase: { ...tipo.legenda, color: colors.textMuted, flex: 1 },
  acoes: { gap: 12, marginTop: spacing.xl },
});
