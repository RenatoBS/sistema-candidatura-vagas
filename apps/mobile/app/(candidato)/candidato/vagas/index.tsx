import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/cliente';
import { Cabecalho } from '@/design-system/Cabecalho';
import { Cartao } from '@/design-system/Cartao';
import { Chip } from '@/design-system/Chip';
import { EstadoVazio } from '@/design-system/EstadoVazio';
import { estilos } from '@/design-system/estilos';
import { ItemLista } from '@/design-system/ItemLista';
import { Tela } from '@/design-system/Tela';
import { colors, spacing, tipo } from '@/design-system/tokens';
import { useConsulta } from '@/hooks/useConsulta';

interface VagaPublica {
  id: string;
  titulo: string;
  senioridade: string;
  modelo: string;
  localidade: string | null;
  prazoInscricoesBrasilia: string | null;
}

export default function VagasCandidatoScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const vagas = useConsulta(['vagas-publicas'], () => api<VagaPublica[]>('/vagas-publicas'), null);
  const lista = vagas.data ?? [];

  return (
    <Tela comAbas>
      <Cabecalho titulo={t('candidato.vagas')} subtitulo="Descubra oportunidades e acompanhe as que combinam com você." />
      <View style={styles.atalhos}>
        <ItemLista titulo={t('candidato.recomendadas')} detalhe="Escolhidas para o seu perfil" icone="sparkles-outline" onPress={() => router.push('/candidato/recomendadas')} />
        <ItemLista titulo={t('candidato.convites')} detalhe="Convites que aguardam você" icone="mail-unread-outline" onPress={() => router.push('/candidato/convites')} />
      </View>
      <View style={styles.secao}>
        <Text style={styles.secaoTitulo}>Oportunidades abertas</Text>
        {!vagas.isLoading && !vagas.isError ? <Text style={styles.contador}>{lista.length} {lista.length === 1 ? 'vaga' : 'vagas'}</Text> : null}
      </View>
      {vagas.isLoading ? <EstadoVazio titulo={t('comum.carregando')} /> : null}
      {vagas.isError ? <EstadoVazio titulo={t('comum.erro')} /> : null}
      {!vagas.isLoading && !vagas.isError && lista.length === 0 ? <EstadoVazio titulo={t('vaga.vazia')} /> : null}
      {lista.map((vaga) => (
        <Cartao key={vaga.id} onPress={() => router.push(`/candidato/vagas/${vaga.id}`)}>
          <Text style={estilos.tituloItem}>{vaga.titulo}</Text>
          <View style={estilos.chips}>
            <Chip texto={vaga.senioridade} tom="destaque" />
            <Chip texto={vaga.modelo} tom="neutro" />
            {vaga.localidade ? <Chip texto={vaga.localidade} /> : null}
          </View>
          <Text style={estilos.legenda}>
            {t('vaga.ate')}: {vaga.prazoInscricoesBrasilia ?? '—'}
          </Text>
        </Cartao>
      ))}
    </Tela>
  );
}

const styles = StyleSheet.create({
  atalhos: { gap: 10 },
  secao: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  secaoTitulo: { ...tipo.destaque, color: colors.text },
  contador: { ...tipo.legenda, color: colors.textMuted },
});
