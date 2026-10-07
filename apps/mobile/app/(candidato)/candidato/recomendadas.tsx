import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';

import { api } from '@/api/cliente';
import { useAuth } from '@/auth/AuthContext';
import { Banner } from '@/design-system/Banner';
import { Cabecalho } from '@/design-system/Cabecalho';
import { Cartao } from '@/design-system/Cartao';
import { EstadoVazio } from '@/design-system/EstadoVazio';
import { estilos } from '@/design-system/estilos';
import { Tela } from '@/design-system/Tela';
import { useConsulta } from '@/hooks/useConsulta';

type Vaga = { id: string; titulo: string; habilidadesEmComum?: string[] };

export default function Recomendadas() {
  const { t } = useTranslation();
  const router = useRouter();
  const { accessToken } = useAuth();
  const q = useConsulta<{ vagas: Vaga[]; visivelParaMatch: boolean }>(['recomendadas'], () =>
    api<{ vagas: Vaga[]; visivelParaMatch: boolean }>('/candidatos/me/vagas-recomendadas', {}, accessToken),
  );
  const vagas = q.data?.vagas ?? [];

  return (
    <Tela>
      <Cabecalho titulo={t('candidato.recomendadas')} voltar />
      {q.isLoading ? <EstadoVazio titulo={t('comum.carregando')} /> : null}
      {q.isError ? <EstadoVazio titulo={t('candidato.recomendadasErro')} /> : null}
      {q.data && !q.data.visivelParaMatch ? <Banner tipo="aviso" texto={t('candidato.recomendadasPrivacidade')} /> : null}
      {!q.isLoading && !q.isError && q.data?.visivelParaMatch && vagas.length === 0 ? (
        <EstadoVazio titulo={t('candidato.recomendadasVazias')} />
      ) : null}
      {vagas.map((v) => (
        <Cartao key={v.id} onPress={() => router.push(`/candidato/vagas/${v.id}`)}>
          <Text style={estilos.tituloItem}>{v.titulo}</Text>
          <Text style={estilos.mudo}>
            {v.habilidadesEmComum?.length
              ? `${t('candidato.habilidadesComum')}: ${v.habilidadesEmComum.join(', ')}`
              : t('candidato.semDetalhe')}
          </Text>
          <Text style={estilos.legenda}>{t('candidato.verVaga')}</Text>
        </Cartao>
      ))}
    </Tela>
  );
}
