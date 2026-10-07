import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/cliente';
import { useAuth } from '@/auth/AuthContext';
import { Banner } from '@/design-system/Banner';
import { Button } from '@/design-system/Button';
import { Cabecalho } from '@/design-system/Cabecalho';
import { Cartao } from '@/design-system/Cartao';
import { Chip } from '@/design-system/Chip';
import { EstadoVazio } from '@/design-system/EstadoVazio';
import { estilos } from '@/design-system/estilos';
import { Tela } from '@/design-system/Tela';
import { colors, spacing, tipo } from '@/design-system/tokens';
import { useConsulta } from '@/hooks/useConsulta';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';

interface StatusWhatsapp {
  status: string | null;
}

interface VagaResumo {
  id: string;
  titulo: string;
  status: string;
  prazoInscricoesBrasilia: string | null;
}

export default function VagasEmpresaScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { accessToken } = useAuth();
  const empresaId = useEmpresaAtiva();
  const whatsapp = useConsulta(
    ['whatsapp-vagas'],
    () => api<StatusWhatsapp>(`/empresas/${empresaId}/whatsapp/status`, {}, accessToken),
    empresaId,
  );
  const vagas = useConsulta(['vagas-empresa'], () => api<VagaResumo[]>(`/empresas/${empresaId}/vagas`, {}, accessToken), empresaId);
  const desconectada = whatsapp.isSuccess && whatsapp.data?.status !== 'CONECTADA';
  const lista = vagas.data ?? [];

  return (
    <Tela comAbas>
      <Cabecalho titulo={t('empresa.vagas')} subtitulo="Crie oportunidades e acompanhe cada etapa do processo." />
      {desconectada ? <Banner tipo="aviso" texto={t('whatsapp.banner')} /> : null}
      <Button label={t('vaga.nova')} onPress={() => router.push('/empresa/vagas/nova')} />
      {!vagas.isLoading && !vagas.isError ? <View style={styles.secao}><Text style={styles.secaoTitulo}>{t('empresa.suasVagas')}</Text><Text style={styles.contador}>{t('empresa.contadorVagas', { count: lista.length })}</Text></View> : null}
      {vagas.isLoading ? <EstadoVazio titulo={t('comum.carregando')} /> : null}
      {vagas.isError ? <EstadoVazio titulo={t('comum.erro')} /> : null}
      {!vagas.isLoading && !vagas.isError && lista.length === 0 ? <EstadoVazio titulo={t('vaga.vazia')} /> : null}
      {lista.map((vaga) => (
        <Cartao key={vaga.id} onPress={() => router.push(`/empresa/vagas/${vaga.id}`)}>
          <Text style={estilos.tituloItem}>{vaga.titulo}</Text>
          <Chip texto={vaga.status} tom={vaga.status === 'PUBLICADA' ? 'sucesso' : 'aviso'} />
          {vaga.prazoInscricoesBrasilia ? (
            <Text style={estilos.legenda}>
              {t('vaga.ate')}: {vaga.prazoInscricoesBrasilia}
            </Text>
          ) : null}
        </Cartao>
      ))}
    </Tela>
  );
}

const styles = StyleSheet.create({
  secao: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xs },
  secaoTitulo: { ...tipo.destaque, color: colors.text },
  contador: { ...tipo.legenda, color: colors.textMuted },
});
