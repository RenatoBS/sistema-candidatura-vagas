import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { api, ErroApi } from '@/api/cliente';
import { useAuth } from '@/auth/AuthContext';
import { Banner } from '@/design-system/Banner';
import { Button } from '@/design-system/Button';
import { colors, spacing } from '@/design-system/tokens';

interface VisaoVoz {
  status: string;
  pergunta: string | null;
  segundosRestantes: number;
  aviso: boolean;
  reconectando: boolean;
}

export default function EntrevistaVozScreen() {
  const { t } = useTranslation();
  const { candidaturaId } = useLocalSearchParams<{ candidaturaId: string }>();
  const { accessToken } = useAuth();
  const [visao, setVisao] = useState<VisaoVoz | null>(null);
  const [confirmar, setConfirmar] = useState(false);
  const [erro, setErro] = useState('');
  const [sessaoId, setSessaoId] = useState('');
  const [entrevistaId, setEntrevistaId] = useState('');

  async function preparar() {
    setErro('');
    try {
      const preparada = await api<{ id: string }>(
        `/voz/candidaturas/${candidaturaId}/preparar`,
        { method: 'POST' },
        accessToken,
      );
      const aceite = await api<{ sessaoId: string; enunciado: string; segundosRestantes: number }>(
        `/voz/entrevistas/${preparada.id}/aceitar`,
        { method: 'POST' },
        accessToken,
      );
      setEntrevistaId(preparada.id);
      setSessaoId(aceite.sessaoId);
      setVisao({
        status: 'EM_SESSAO',
        pergunta: aceite.enunciado,
        segundosRestantes: aceite.segundosRestantes,
        aviso: aceite.segundosRestantes <= 15,
        reconectando: false,
      });
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : t('comum.erro'));
    }
  }

  async function atualizar() {
    if (!entrevistaId) return;
    const dados = await api<VisaoVoz>(`/voz/entrevistas/${entrevistaId}`, {}, accessToken);
    setVisao(dados);
  }

  async function reconectar() {
    setErro('');
    try {
      await api(`/voz/sessoes/${sessaoId}/reconectar`, { method: 'POST' }, accessToken);
      await atualizar();
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : t('comum.erro'));
    }
  }

  async function encerrar() {
    setErro('');
    try {
      await api(`/voz/sessoes/${sessaoId}/encerrar`, { method: 'POST' }, accessToken);
      setConfirmar(false);
      await atualizar();
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : t('comum.erro'));
    }
  }

  return (
    <View style={styles.tela}>
      <Text style={styles.titulo}>{t('voz.titulo')}</Text>
      <Text style={styles.texto}>{t('voz.precheck')}</Text>
      {erro ? <Banner tipo="erro" texto={erro} /> : null}
      {visao?.aviso ? <Banner tipo="aviso" texto={t('voz.aviso')} /> : null}
      {visao?.reconectando ? <Text style={styles.texto}>{t('voz.reconectar')}</Text> : null}
      <Text style={styles.texto}>{visao?.pergunta ?? '—'}</Text>
      <Text style={styles.texto}>
        {t('voz.tempo')}: {visao?.segundosRestantes ?? '—'}
      </Text>
      {!sessaoId ? <Button label={t('voz.titulo')} onPress={() => void preparar()} /> : null}
      {visao?.reconectando ? <Button label={t('voz.reconectar')} onPress={() => void reconectar()} /> : null}
      {sessaoId && !confirmar ? <Button label={t('voz.encerrar')} onPress={() => setConfirmar(true)} /> : null}
      {confirmar ? (
        <View style={styles.bloco}>
          <Text style={styles.texto}>{t('voz.confirmar')}</Text>
          <Button label={t('voz.confirmarSim')} onPress={() => void encerrar()} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, padding: spacing.lg, backgroundColor: colors.background, gap: spacing.md },
  titulo: { fontSize: 22, fontWeight: '700', color: colors.text },
  texto: { color: colors.text },
  bloco: { gap: spacing.sm },
});
