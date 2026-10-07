import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/cliente';
import { Button } from '@/design-system/Button';
import { Tela } from '@/design-system/Tela';
import { colors, spacing, tipo } from '@/design-system/tokens';

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
      <View style={styles.bloco}>
        <Text style={styles.titulo}>{t('home.title')}</Text>
        <Text style={styles.subtitulo}>{t('home.subtitle')}</Text>
        <Text style={styles.fase}>{t('home.phase')}</Text>
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
  bloco: { gap: spacing.sm },
  titulo: { ...tipo.titulo, color: colors.text },
  subtitulo: { ...tipo.corpo, color: colors.textMuted },
  fase: { ...tipo.legenda, color: colors.primary },
  acoes: { gap: spacing.sm, marginTop: spacing.lg },
});
