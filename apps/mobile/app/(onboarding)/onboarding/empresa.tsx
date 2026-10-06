import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { api } from '@/api/cliente';
import type { SessaoApp } from '@/auth/acesso';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/design-system/Button';
import { Campo } from '@/design-system/Campo';
import { colors, spacing } from '@/design-system/tokens';

export default function CadastroEmpresaScreen() {
  const { t } = useTranslation();
  const { accessToken, entrar } = useAuth();
  const router = useRouter();
  const [razaoSocial, setRazao] = useState('');
  const [nomeFantasia, setFantasia] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [dominio, setDominio] = useState('');
  const [responsavelNome, setResponsavel] = useState('');
  const [responsavelEmail, setEmail] = useState('');

  async function enviar() {
    const resposta = await api<{
      empresa: { id: string };
      sessao: { accessToken: string; refreshToken: string; perfil: SessaoApp };
    }>(
      '/empresas/cadastro',
      {
        method: 'POST',
        body: JSON.stringify({ razaoSocial, nomeFantasia, cnpj, dominio, responsavelNome, responsavelEmail }),
      },
      accessToken,
    );
    await entrar(
      { accessToken: resposta.sessao.accessToken, refreshToken: resposta.sessao.refreshToken },
      resposta.sessao.perfil,
    );
    router.replace('/empresa/verificacao');
  }

  return (
    <ScrollView contentContainerStyle={styles.tela}>
      <Text style={styles.titulo}>{t('onboarding.empresa')}</Text>
      <Campo label={t('empresa.razao')} value={razaoSocial} onChangeText={setRazao} />
      <Campo label={t('empresa.fantasia')} value={nomeFantasia} onChangeText={setFantasia} />
      <Campo label={t('empresa.cnpj')} value={cnpj} onChangeText={setCnpj} autoCapitalize="none" />
      <Campo label={t('empresa.dominio')} value={dominio} onChangeText={setDominio} autoCapitalize="none" />
      <Campo label={t('empresa.responsavel')} value={responsavelNome} onChangeText={setResponsavel} />
      <Campo label={t('empresa.emailResponsavel')} value={responsavelEmail} onChangeText={setEmail} autoCapitalize="none" />
      <Button label={t('comum.enviar')} onPress={() => void enviar()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  tela: { padding: spacing.lg, backgroundColor: colors.background },
  titulo: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
});
