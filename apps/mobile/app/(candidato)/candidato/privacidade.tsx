import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '@/api/cliente';
import { useAuth } from '@/auth/AuthContext';
import { Banner } from '@/design-system/Banner';
import { Button } from '@/design-system/Button';
import { Cabecalho } from '@/design-system/Cabecalho';
import { Cartao } from '@/design-system/Cartao';
import { LinhaInterruptor } from '@/design-system/LinhaInterruptor';
import { Tela } from '@/design-system/Tela';
import { TIPOS_PRIVACIDADE } from '@/perfil/regras';

const VERSAO = '2026-10-06';

export default function PrivacidadeCandidato() {
  const { t } = useTranslation();
  const { accessToken } = useAuth();
  const [concedidos, setConcedidos] = useState<Record<string, boolean>>({});
  const [visivel, setVisivel] = useState(true);
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState(false);

  useEffect(() => {
    void carregar().catch(() => undefined);
  }, [accessToken]);

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
      setErro(false);
      setMensagem(t('candidato.perfilSalvo'));
    } catch {
      setErro(true);
      setMensagem(t('comum.erro'));
    }
  }

  return (
    <Tela>
      <Cabecalho titulo={t('candidato.privacidade')} voltar />
      <Button label={t('candidato.carregar')} variante="secundario" onPress={() => void carregar()} />
      <Cartao>
        <LinhaInterruptor label={t('candidato.visivelMatch')} value={visivel} onValueChange={setVisivel} />
        {TIPOS_PRIVACIDADE.map((tipo) => (
          <LinhaInterruptor
            key={tipo}
            label={t(`candidato.consentimento.${tipo}`)}
            value={Boolean(concedidos[tipo])}
            onValueChange={(valor) => setConcedidos((atual) => ({ ...atual, [tipo]: valor }))}
          />
        ))}
      </Cartao>
      {mensagem ? <Banner tipo={erro ? 'erro' : 'ok'} texto={mensagem} /> : null}
      <Button label={t('comum.salvar')} onPress={() => void salvar()} />
    </Tela>
  );
}
