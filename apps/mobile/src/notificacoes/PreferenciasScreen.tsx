import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { api } from '@/api/cliente';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/design-system/Button';
import { colors, spacing } from '@/design-system/tokens';

interface PreferenciaNotificacao {
  tipo: 'CANDIDATO_NOVO' | 'MATCH_FORTE';
  inApp?: boolean;
  push?: boolean;
  email?: boolean;
  limiarMatch?: number | null;
}
const ROTULOS: Record<PreferenciaNotificacao['tipo'], string> = {
  CANDIDATO_NOVO: 'Novo candidato',
  MATCH_FORTE: 'Match forte',
};

export function PreferenciasScreen() {
  const { accessToken } = useAuth();
  const [itens, setItens] = useState<PreferenciaNotificacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  useEffect(() => {
    void api<PreferenciaNotificacao[]>('/notificacoes/preferencias', {}, accessToken)
      .then(setItens)
      .catch(() => setMensagem('Não foi possível carregar as preferências.'))
      .finally(() => setCarregando(false));
  }, [accessToken]);
  function atualizar(indice: number, mudanca: Partial<PreferenciaNotificacao>) {
    setItens((atuais) =>
      atuais.map((item, index) => (index === indice ? { ...item, ...mudanca } : item)),
    );
  }
  async function salvar() {
    setSalvando(true);
    setMensagem('');
    try {
      await api(
        '/notificacoes/preferencias',
        { method: 'PUT', body: JSON.stringify({ itens }) },
        accessToken,
      );
      setMensagem('Preferências salvas.');
    } catch {
      setMensagem('Não foi possível salvar as preferências.');
    } finally {
      setSalvando(false);
    }
  }
  if (carregando) return <ActivityIndicator style={styles.carregando} color={colors.primary} />;
  return (
    <ScrollView style={styles.tela} contentContainerStyle={styles.conteudo}>
      <Text style={styles.titulo}>Preferências de notificações</Text>
      {itens.length === 0 ? (
        <Text style={styles.texto}>Nenhuma preferência disponível.</Text>
      ) : null}
      {itens.map((item, indice) => (
        <View style={styles.card} key={item.tipo}>
          <Text style={styles.subtitulo}>{ROTULOS[item.tipo]}</Text>
          <LinhaSwitch
            label="Notificação no app"
            value={item.inApp ?? false}
            onChange={(value) => atualizar(indice, { inApp: value })}
          />
          <LinhaSwitch
            label="Notificação push"
            value={item.push ?? false}
            onChange={(value) => atualizar(indice, { push: value })}
          />
          <LinhaSwitch
            label="E-mail"
            value={item.email ?? false}
            onChange={(value) => atualizar(indice, { email: value })}
          />
          {item.tipo === 'MATCH_FORTE' ? (
            <View style={styles.limiar}>
              <Text style={styles.texto}>Limiar do match forte (0 a 1)</Text>
              <TextInput
                accessibilityLabel="Limiar do match forte"
                keyboardType="decimal-pad"
                style={styles.input}
                value={item.limiarMatch == null ? '' : String(item.limiarMatch)}
                onChangeText={(value) => {
                  const numero = Number(value.replace(',', '.'));
                  atualizar(indice, {
                    limiarMatch: Number.isFinite(numero) ? Math.min(1, Math.max(0, numero)) : null,
                  });
                }}
              />
            </View>
          ) : null}
        </View>
      ))}
      {mensagem ? <Text style={styles.mensagem}>{mensagem}</Text> : null}
      <Button
        label={salvando ? 'Salvando…' : 'Salvar preferências'}
        onPress={() => void salvar()}
      />
    </ScrollView>
  );
}
function LinhaSwitch({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.linha}>
      <Text style={styles.texto}>{label}</Text>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}
const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  conteudo: { padding: spacing.lg, gap: spacing.md },
  carregando: { flex: 1 },
  titulo: { color: colors.text, fontSize: 22, fontWeight: '700' },
  subtitulo: { color: colors.text, fontSize: 17, fontWeight: '700' },
  texto: { color: colors.text },
  card: { backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md, gap: spacing.sm },
  linha: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  limiar: { gap: spacing.xs },
  input: {
    borderColor: colors.border,
    borderRadius: 6,
    borderWidth: 1,
    color: colors.text,
    padding: spacing.sm,
  },
  mensagem: { color: colors.textMuted },
});
