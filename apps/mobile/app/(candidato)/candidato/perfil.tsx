import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';

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
      <Cabecalho titulo={t('candidato.perfil')} subtitulo={t('candidato.texto')} />
      <Button label={t('candidato.carregar')} variante="secundario" onPress={() => void carregar()} />
      <Campo label={t('onboarding.nome')} value={nome} onChangeText={setNome} />
      <Campo label={t('candidato.whatsapp')} value={whatsapp} onChangeText={setWhatsapp} autoCapitalize="none" />
      <Campo label={t('candidato.linkedin')} value={linkedinUrl} onChangeText={setLinkedinUrl} autoCapitalize="none" />
      <Text style={estilos.legenda}>{t('candidato.linkedinAjuda')}</Text>
      {mensagem ? <Banner tipo={erro ? 'erro' : 'ok'} texto={mensagem} /> : null}
      <Button label={t('comum.salvar')} onPress={() => void salvar()} />
      <ItemLista titulo={t('candidato.curriculo')} onPress={() => router.push('/candidato/curriculo')} />
      <ItemLista titulo={t('candidato.habilidades')} onPress={() => router.push('/candidato/habilidades')} />
      <ItemLista titulo={t('candidato.privacidade')} onPress={() => router.push('/candidato/privacidade')} />
      <ItemLista titulo={t('candidato.dados')} onPress={() => router.push('/candidato/dados')} />
      <ItemLista titulo={t('notificacoes.preferencias')} onPress={() => router.push('/candidato/notificacoes-preferencias')} />
      <TrocaVisao />
    </Tela>
  );
}
