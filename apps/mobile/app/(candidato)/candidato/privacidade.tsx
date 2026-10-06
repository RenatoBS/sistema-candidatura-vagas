import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { api } from '@/api/cliente';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/design-system/Button';
import { colors, spacing } from '@/design-system/tokens';
import { TIPOS_PRIVACIDADE } from '@/perfil/regras';

const VERSAO = '2026-10-06';

export default function PrivacidadeCandidato() {
  const { t } = useTranslation();
  const { accessToken } = useAuth();
  const [concedidos, setConcedidos] = useState<Record<string, boolean>>({});
  const [visivel, setVisivel] = useState(true);
  const [mensagem, setMensagem] = useState('');

  async function carregar() {
    const [perfil, lista] = await Promise.all([
      api<{ visivelParaMatch: boolean }>('/candidatos/me', {}, accessToken),
      api<{ tipo: string; concedido: boolean }[]>('/candidatos/me/consentimentos', {}, accessToken),
    ]);
    setVisivel(perfil.visivelParaMatch);
    const mapa: Record<string, boolean> = {};
    for (const item of lista) mapa[item.tipo] = item.concedido;
    setConcedidos(mapa);
  }

  async function salvar() {
    try {
      await api('/candidatos/me', { method: 'PUT', body: JSON.stringify({ visivelParaMatch: visivel }) }, accessToken);
      for (const tipo of TIPOS_PRIVACIDADE) {
        await api(
          '/candidatos/me/consentimentos',
          { method: 'POST', body: JSON.stringify({ tipo, concedido: Boolean(concedidos[tipo]), versaoTermo: VERSAO }) },
          accessToken,
        );
      }
      setMensagem(t('candidato.perfilSalvo'));
    } catch {
      setMensagem(t('comum.erro'));
    }
  }

  return (
    <View style={styles.tela}>
      <Text style={styles.titulo}>{t('candidato.privacidade')}</Text>
      <Button label={t('candidato.carregar')} onPress={() => void carregar()} />
      <View style={styles.linha}>
        <Text style={styles.texto}>{t('candidato.visivelMatch')}</Text>
        <Switch value={visivel} onValueChange={setVisivel} />
      </View>
      {TIPOS_PRIVACIDADE.map((tipo) => (
        <View key={tipo} style={styles.linha}>
          <Text style={styles.texto}>{t(`candidato.consentimento.${tipo}`)}</Text>
          <Switch
            value={Boolean(concedidos[tipo])}
            onValueChange={(valor) => setConcedidos((atual) => ({ ...atual, [tipo]: valor }))}
          />
        </View>
      ))}
      {mensagem ? <Text style={styles.texto}>{mensagem}</Text> : null}
      <Button label={t('comum.salvar')} onPress={() => void salvar()} />
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, padding: spacing.lg, backgroundColor: colors.background, gap: spacing.sm },
  titulo: { fontSize: 22, fontWeight: '700', color: colors.text },
  linha: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  texto: { color: colors.text, flex: 1 },
});
