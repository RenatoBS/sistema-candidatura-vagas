import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text } from 'react-native';

import { api } from '@/api/cliente';
import { useAuth } from '@/auth/AuthContext';
import { Banner } from '@/design-system/Banner';
import { Button } from '@/design-system/Button';
import { Cabecalho } from '@/design-system/Cabecalho';
import { Cartao } from '@/design-system/Cartao';
import { Tela } from '@/design-system/Tela';
import { colors, tipo } from '@/design-system/tokens';
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
  const [erro, setErro] = useState(false);

  useEffect(() => {
    void carregar().catch(() => undefined);
  }, [accessToken]);

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
      setErro(false);
      setMensagem(t('candidato.perfilSalvo'));
    } catch {
      setErro(true);
      setMensagem(t('comum.erro'));
    }
  }

  return (
    <Tela>
      <Cabecalho titulo={t('candidato.habilidades')} voltar />
      <Button label={t('candidato.carregar')} variante="secundario" onPress={() => void carregar()} />
      {catalogo.map((item) => {
        const ativa = habilidadesMarcadas(escolhidas, item.id);
        return (
          <Pressable key={item.id} onPress={() => alternar(item.id)}>
            <Cartao destaque={ativa}>
              <Text style={{ ...tipo.destaque, color: ativa ? colors.primary : colors.text }}>{item.nome}</Text>
            </Cartao>
          </Pressable>
        );
      })}
      {mensagem ? <Banner tipo={erro ? 'erro' : 'ok'} texto={mensagem} /> : null}
      <Button label={t('comum.salvar')} onPress={() => void salvar()} />
    </Tela>
  );
}
