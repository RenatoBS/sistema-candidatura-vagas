import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/cliente';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/design-system/Button';
import { colors, spacing } from '@/design-system/tokens';
import { habilidadesMarcadas } from '@/perfil/regras';

interface ItemCatalogo {
  id: string;
  nome: string;
}

interface Selecionada {
  habilidadeId: string;
  nivel: number;
}

export default function HabilidadesCandidato() {
  const { t } = useTranslation();
  const { accessToken } = useAuth();
  const [catalogo, setCatalogo] = useState<ItemCatalogo[]>([]);
  const [escolhidas, setEscolhidas] = useState<Selecionada[]>([]);
  const [mensagem, setMensagem] = useState('');

  async function carregar() {
    const resposta = await api<{ catalogo: ItemCatalogo[]; selecionadas: Selecionada[] }>(
      '/candidatos/me/habilidades',
      {},
      accessToken,
    );
    setCatalogo(resposta.catalogo);
    setEscolhidas(resposta.selecionadas.filter((item) => item.habilidadeId));
  }

  function alternar(id: string) {
    setEscolhidas((atual) =>
      habilidadesMarcadas(atual, id) ? atual.filter((item) => item.habilidadeId !== id) : [...atual, { habilidadeId: id, nivel: 3 }],
    );
  }

  async function salvar() {
    try {
      await api('/candidatos/me/habilidades', { method: 'PUT', body: JSON.stringify({ itens: escolhidas }) }, accessToken);
      setMensagem(t('candidato.perfilSalvo'));
    } catch {
      setMensagem(t('comum.erro'));
    }
  }

  return (
    <View style={styles.tela}>
      <Text style={styles.titulo}>{t('candidato.habilidades')}</Text>
      <Button label={t('candidato.carregar')} onPress={() => void carregar()} />
      {catalogo.map((item) => {
        const ativa = habilidadesMarcadas(escolhidas, item.id);
        return (
          <Pressable key={item.id} onPress={() => alternar(item.id)} style={styles.item}>
            <Text style={{ color: ativa ? colors.primary : colors.text }}>{item.nome}</Text>
          </Pressable>
        );
      })}
      {mensagem ? <Text style={styles.mensagem}>{mensagem}</Text> : null}
      <Button label={t('comum.salvar')} onPress={() => void salvar()} />
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, padding: spacing.lg, backgroundColor: colors.background, gap: spacing.sm },
  titulo: { fontSize: 22, fontWeight: '700', color: colors.text },
  item: { paddingVertical: spacing.sm },
  mensagem: { color: colors.text },
});
