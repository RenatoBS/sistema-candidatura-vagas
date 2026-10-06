import { Link } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { api, ErroApi } from '@/api/cliente';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/design-system/Button';
import { Campo } from '@/design-system/Campo';
import { colors, spacing } from '@/design-system/tokens';

interface PerfilResposta {
  nome: string;
  whatsapp: string | null;
  linkedinUrl: string | null;
  visivelParaMatch: boolean;
}

export default function PerfilCandidato() {
  const { t } = useTranslation();
  const { accessToken } = useAuth();
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [mensagem, setMensagem] = useState('');

  async function carregar() {
    const perfil = await api<PerfilResposta>('/candidatos/me', {}, accessToken);
    setNome(perfil.nome);
    setWhatsapp(perfil.whatsapp ?? '');
    setLinkedinUrl(perfil.linkedinUrl ?? '');
  }

  async function salvar() {
    try {
      await api('/candidatos/me', {
        method: 'PUT',
        body: JSON.stringify({
          nome,
          whatsapp: whatsapp.trim() ? whatsapp : null,
          linkedinUrl: linkedinUrl.trim() ? linkedinUrl : null,
        }),
      }, accessToken);
      setMensagem(t('candidato.perfilSalvo'));
    } catch (erro) {
      setMensagem(erro instanceof ErroApi && erro.codigo === 'LINKEDIN_INVALIDO' ? t('candidato.linkedinInvalido') : t('comum.erro'));
    }
  }

  return (
    <View style={styles.tela}>
      <Text style={styles.titulo}>{t('candidato.perfil')}</Text>
      <Button label={t('candidato.carregar')} onPress={() => void carregar()} />
      <Campo label={t('onboarding.nome')} value={nome} onChangeText={setNome} />
      <Campo label={t('candidato.whatsapp')} value={whatsapp} onChangeText={setWhatsapp} autoCapitalize="none" />
      <Campo label={t('candidato.linkedin')} value={linkedinUrl} onChangeText={setLinkedinUrl} autoCapitalize="none" />
      <Text style={styles.ajuda}>{t('candidato.linkedinAjuda')}</Text>
      {mensagem ? <Text style={styles.mensagem}>{mensagem}</Text> : null}
      <Button label={t('comum.salvar')} onPress={() => void salvar()} />
      <Link href="/candidato/curriculo">{t('candidato.curriculo')}</Link>
      <Link href="/candidato/habilidades">{t('candidato.habilidades')}</Link>
      <Link href="/candidato/privacidade">{t('candidato.privacidade')}</Link>
      <Link href="/candidato/dados">{t('candidato.dados')}</Link>
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, padding: spacing.lg, backgroundColor: colors.background, gap: spacing.sm },
  titulo: { fontSize: 22, fontWeight: '700', color: colors.text },
  ajuda: { color: colors.textMuted },
  mensagem: { color: colors.text },
});
