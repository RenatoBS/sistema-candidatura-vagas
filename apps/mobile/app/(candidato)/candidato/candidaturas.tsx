import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';

import { api } from '@/api/cliente';
import { useAuth } from '@/auth/AuthContext';
import { rotuloStatus } from '@/candidatura/regras';
import { Banner } from '@/design-system/Banner';
import { Cabecalho } from '@/design-system/Cabecalho';
import { Cartao } from '@/design-system/Cartao';
import { EstadoVazio } from '@/design-system/EstadoVazio';
import { estilos } from '@/design-system/estilos';
import { Tela } from '@/design-system/Tela';
import { useConsulta } from '@/hooks/useConsulta';

type Candidatura = {
  id: string;
  vagaTitulo?: string | null;
  vaga?: { titulo: string };
  status?: string;
  fase?: string;
  rotuloAmigavel?: string;
};

export default function Candidaturas() {
  const { t } = useTranslation();
  const router = useRouter();
  const { accessToken } = useAuth();
  const q = useConsulta<Candidatura[]>(['candidaturas'], () => api<Candidatura[]>('/candidatos/me/candidaturas', {}, accessToken));
  const lista = q.data ?? [];

  return (
    <Tela comAbas>
      <Cabecalho titulo={t('candidato.candidaturas')} />
      {q.isLoading ? <EstadoVazio titulo={t('comum.carregando')} /> : null}
      {q.isError ? <EstadoVazio titulo={t('candidato.candidaturasErro')} /> : null}
      {!q.isLoading && !q.isError && lista.length === 0 ? <EstadoVazio titulo={t('candidato.candidaturasVazias')} /> : null}
      {lista.length > 1 ? <Banner tipo="aviso" texto={t('candidato.variosProcessos')} /> : null}
      {lista.map((c) => (
        <Cartao key={c.id} onPress={() => router.push(`/candidato/candidaturas/${c.id}`)}>
          <Text style={estilos.tituloItem}>{c.vagaTitulo || c.vaga?.titulo || t('comum.vaga')}</Text>
          <Text style={estilos.mudo}>{c.rotuloAmigavel ?? rotuloStatus(c.status, c.fase)}</Text>
          <Text style={estilos.legenda}>{t('comum.verDetalhes')}</Text>
        </Cartao>
      ))}
    </Tela>
  );
}
