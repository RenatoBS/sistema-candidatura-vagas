import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';

import { api } from '@/api/cliente';
import { useAuth } from '@/auth/AuthContext';
import { rotuloStatus } from '@/candidatura/regras';
import { Banner } from '@/design-system/Banner';
import { Button } from '@/design-system/Button';
import { Cabecalho } from '@/design-system/Cabecalho';
import { Chip } from '@/design-system/Chip';
import { estilos } from '@/design-system/estilos';
import { Tela } from '@/design-system/Tela';
import { useConsulta } from '@/hooks/useConsulta';

export default function Detalhe() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { accessToken } = useAuth();
  const q = useConsulta<{
    vagaTitulo?: string | null;
    vaga?: { titulo: string };
    status?: string;
    fase?: string;
    rotuloAmigavel?: string;
  }>(['candidatura', id ?? ''], () => api(`/candidatos/me/candidaturas/${id}`, {}, accessToken));
  const rotulo = q.data?.rotuloAmigavel ?? rotuloStatus(q.data?.status, q.data?.fase);
  const podeVoz = q.data?.status === 'ENTREVISTA_VOZ' || q.data?.status === 'TRIAGEM_CONCLUIDA';

  return (
    <Tela>
      <Cabecalho titulo={q.data?.vagaTitulo || q.data?.vaga?.titulo || t('candidato.candidatura')} voltar />
      {q.isLoading ? <Text style={estilos.mudo}>{t('comum.carregando')}</Text> : null}
      {q.isError ? <Banner tipo="erro" texto={t('candidato.candidaturasErro')} /> : null}
      {rotulo ? <Chip texto={rotulo} /> : null}
      {podeVoz ? (
        <Button label={t('candidato.entrevistaVoz')} onPress={() => router.push(`/candidato/voz/${id}`)} />
      ) : null}
    </Tela>
  );
}
