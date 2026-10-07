import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { api } from '@/api/cliente';
import { Cabecalho } from '@/design-system/Cabecalho';
import { Cartao } from '@/design-system/Cartao';
import { Chip } from '@/design-system/Chip';
import { EstadoVazio } from '@/design-system/EstadoVazio';
import { estilos } from '@/design-system/estilos';
import { ItemLista } from '@/design-system/ItemLista';
import { Tela } from '@/design-system/Tela';
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
      <Cabecalho titulo={t('candidato.vagas')} />
      <ItemLista titulo={t('candidato.convites')} onPress={() => router.push('/candidato/convites')} />
      <ItemLista titulo={t('candidato.recomendadas')} onPress={() => router.push('/candidato/recomendadas')} />
      {vagas.isLoading ? <EstadoVazio titulo={t('comum.carregando')} /> : null}
      {vagas.isError ? <EstadoVazio titulo={t('comum.erro')} /> : null}
      {!vagas.isLoading && !vagas.isError && lista.length === 0 ? <EstadoVazio titulo={t('vaga.vazia')} /> : null}
      {lista.map((vaga) => (
        <Cartao key={vaga.id} onPress={() => router.push(`/candidato/vagas/${vaga.id}`)}>
          <Text style={estilos.tituloItem}>{vaga.titulo}</Text>
          <View style={estilos.chips}>
            <Chip texto={vaga.senioridade} />
            <Chip texto={vaga.modelo} />
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
