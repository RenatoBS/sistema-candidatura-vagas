import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { api, ErroApi } from '@/api/cliente';
import { useAuth } from '@/auth/AuthContext';
import { TrocaVisao } from '@/componentes/TrocaVisao';
import { Banner } from '@/design-system/Banner';
import { Button } from '@/design-system/Button';
import { Cabecalho } from '@/design-system/Cabecalho';
import { Campo } from '@/design-system/Campo';
import { estilos } from '@/design-system/estilos';
import { ItemLista } from '@/design-system/ItemLista';
import { Tela } from '@/design-system/Tela';
import { colors, radius, spacing, tipo } from '@/design-system/tokens';

interface PerfilResposta {
  nome: string;
  whatsapp: string | null;
  linkedinUrl: string | null;
  visivelParaMatch: boolean;
}

export default function PerfilCandidato() {
  const { t } = useTranslation();
  const router = useRouter();
  const { accessToken } = useAuth();
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState(false);

  useEffect(() => {
    void carregar().catch(() => undefined);
  }, [accessToken]);

  async function carregar() {
    const perfil = await api<PerfilResposta>('/candidatos/me', {}, accessToken);
    setNome(perfil.nome);
    setWhatsapp(perfil.whatsapp ?? '');
    setLinkedinUrl(perfil.linkedinUrl ?? '');
  }

  async function salvar() {
    try {
      await api(
        '/candidatos/me',
        {
          method: 'PUT',
          body: JSON.stringify({
            nome,
            whatsapp: whatsapp.trim() ? whatsapp : null,
            linkedinUrl: linkedinUrl.trim() ? linkedinUrl : null,
          }),
        },
        accessToken,
      );
      setErro(false);
      setMensagem(t('candidato.perfilSalvo'));
    } catch (falha) {
      setErro(true);
      setMensagem(falha instanceof ErroApi && falha.codigo === 'LINKEDIN_INVALIDO' ? t('candidato.linkedinInvalido') : t('comum.erro'));
    }
  }

  return (
    <Tela comAbas teclado>
      <Cabecalho titulo={t('candidato.perfil')} subtitulo="Deixe seu perfil pronto para encontrar vagas mais relevantes." />
      <View style={styles.identidade}>
        <View style={styles.avatar}><Text style={styles.avatarTexto}>{nome.trim().charAt(0).toUpperCase() || '•'}</Text></View>
        <View style={styles.identidadeTexto}><Text style={styles.nome}>{nome || 'Seu perfil'}</Text><Text style={styles.descricao}>Dados visíveis somente quando você autorizar.</Text></View>
      </View>
      <View style={styles.formulario}>
        <View style={styles.linhaSecao}><Text style={styles.secao}>Informações pessoais</Text><Text style={styles.atualizar} onPress={() => void carregar()}>{t('candidato.carregar')}</Text></View>
        <Campo label={t('onboarding.nome')} value={nome} onChangeText={setNome} />
        <Campo label={t('candidato.whatsapp')} value={whatsapp} onChangeText={setWhatsapp} autoCapitalize="none" />
        <Campo label={t('candidato.linkedin')} value={linkedinUrl} onChangeText={setLinkedinUrl} autoCapitalize="none" />
        <Text style={estilos.legenda}>{t('candidato.linkedinAjuda')}</Text>
        {mensagem ? <Banner tipo={erro ? 'erro' : 'ok'} texto={mensagem} /> : null}
        <Button label={t('comum.salvar')} onPress={() => void salvar()} />
      </View>
      <Text style={styles.secao}>Seu desenvolvimento</Text>
      <ItemLista titulo={t('candidato.curriculo')} detalhe="Envie, revise e mantenha atualizado" icone="document-text-outline" onPress={() => router.push('/candidato/curriculo')} />
      <ItemLista titulo={t('candidato.habilidades')} detalhe="Destaque o que você sabe fazer" icone="color-wand-outline" onPress={() => router.push('/candidato/habilidades')} />
      <Text style={styles.secao}>Privacidade e preferências</Text>
      <ItemLista titulo={t('candidato.privacidade')} icone="shield-checkmark-outline" onPress={() => router.push('/candidato/privacidade')} />
      <ItemLista titulo={t('candidato.dados')} icone="lock-closed-outline" onPress={() => router.push('/candidato/dados')} />
      <ItemLista titulo={t('notificacoes.preferencias')} icone="notifications-outline" onPress={() => router.push('/candidato/notificacoes-preferencias')} />
      <TrocaVisao />
    </Tela>
  );
}

const styles = StyleSheet.create({
  identidade: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.primarySoft, padding: 16, borderRadius: radius.lg },
  avatar: { width: 50, height: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: colors.primary },
  avatarTexto: { ...tipo.secao, color: colors.onPrimary },
  identidadeTexto: { flex: 1, gap: 2 },
  nome: { ...tipo.destaque, color: colors.text },
  descricao: { ...tipo.legenda, color: colors.textMuted },
  formulario: { gap: spacing.md },
  linhaSecao: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  secao: { ...tipo.destaque, color: colors.text, marginTop: spacing.xs },
  atualizar: { ...tipo.legenda, color: colors.primary },
});
