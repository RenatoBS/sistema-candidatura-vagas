import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/cliente';
import { Button } from '@/design-system/Button';
import { Campo } from '@/design-system/Campo';
import { colors, spacing } from '@/design-system/tokens';

export default function RedefinirScreen() {
  const { t } = useTranslation();
  const [token, setToken] = useState('');
  const [senha, setSenha] = useState('');

  return (
    <View style={styles.tela}>
      <Text style={styles.titulo}>{t('auth.redefinirTitulo')}</Text>
      <Campo label={t('auth.codigo')} value={token} onChangeText={setToken} autoCapitalize="none" />
      <Campo label={t('auth.senha')} value={senha} onChangeText={setSenha} secureTextEntry autoCapitalize="none" />
      <Button
        label={t('comum.salvar')}
        onPress={() => void api('/auth/redefinir', { method: 'POST', body: JSON.stringify({ token, senha }) })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, padding: spacing.lg, backgroundColor: colors.background },
  titulo: { fontSize: 24, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
});
