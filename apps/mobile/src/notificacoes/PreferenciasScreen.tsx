import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';

import { api } from '@/api/cliente';
import { useAuth } from '@/auth/AuthContext';
import { Banner } from '@/design-system/Banner';
import { Button } from '@/design-system/Button';
import { Cabecalho } from '@/design-system/Cabecalho';
import { Campo } from '@/design-system/Campo';
import { Cartao } from '@/design-system/Cartao';
import { EstadoVazio } from '@/design-system/EstadoVazio';
import { estilos } from '@/design-system/estilos';
import { LinhaInterruptor } from '@/design-system/LinhaInterruptor';
import { Tela } from '@/design-system/Tela';

interface PreferenciaNotificacao {
  tipo: 'CANDIDATO_NOVO' | 'MATCH_FORTE';
  inApp?: boolean;
  push?: boolean;
  email?: boolean;
  limiarMatch?: number | null;
}

export function PreferenciasScreen() {
  const { t } = useTranslation();
  const { accessToken } = useAuth();
  const [itens, setItens] = useState<PreferenciaNotificacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState(false);

  useEffect(() => {
    void api<{ itens: PreferenciaNotificacao[] }>('/notificacoes/preferencias', {}, accessToken)
      .then((resposta) => setItens(Array.isArray(resposta.itens) ? resposta.itens : []))
      .catch(() => {
        setErro(true);
        setMensagem(t('notificacoes.erroCarregar'));
      })
      .finally(() => setCarregando(false));
  }, [accessToken, t]);

  function atualizar(indice: number, mudanca: Partial<PreferenciaNotificacao>) {
    setItens((atuais) => atuais.map((item, index) => (index === indice ? { ...item, ...mudanca } : item)));
  }

  async function salvar() {
    setSalvando(true);
    setMensagem('');
    try {
      await api('/notificacoes/preferencias', { method: 'PUT', body: JSON.stringify({ itens }) }, accessToken);
      setErro(false);
      setMensagem(t('notificacoes.salvas'));
    } catch {
      setErro(true);
      setMensagem(t('notificacoes.erroSalvar'));
    } finally {
      setSalvando(false);
    }
  }

  const rotulos: Record<PreferenciaNotificacao['tipo'], string> = {
    CANDIDATO_NOVO: t('notificacoes.candidatoNovo'),
    MATCH_FORTE: t('notificacoes.matchForte'),
  };

  return (
    <Tela teclado>
      <Cabecalho titulo={t('notificacoes.preferencias')} voltar />
      {carregando ? <EstadoVazio titulo={t('comum.carregando')} /> : null}
      {!carregando && itens.length === 0 && !erro ? <EstadoVazio titulo={t('notificacoes.vazias')} /> : null}
      {itens.map((item, indice) => (
        <Cartao key={item.tipo}>
          <Text style={estilos.tituloItem}>{rotulos[item.tipo]}</Text>
          <LinhaInterruptor label={t('notificacoes.inApp')} value={item.inApp ?? false} onValueChange={(value) => atualizar(indice, { inApp: value })} />
          <LinhaInterruptor label={t('notificacoes.push')} value={item.push ?? false} onValueChange={(value) => atualizar(indice, { push: value })} />
          <LinhaInterruptor label={t('notificacoes.email')} value={item.email ?? false} onValueChange={(value) => atualizar(indice, { email: value })} />
          {item.tipo === 'MATCH_FORTE' ? (
            <Campo
              label={t('notificacoes.limiar')}
              keyboardType="decimal-pad"
              value={item.limiarMatch == null ? '' : String(item.limiarMatch)}
              onChangeText={(value) => {
                const numero = Number(value.replace(',', '.'));
                atualizar(indice, { limiarMatch: Number.isFinite(numero) ? Math.min(1, Math.max(0, numero)) : null });
              }}
            />
          ) : null}
        </Cartao>
      ))}
      {mensagem ? <Banner tipo={erro ? 'erro' : 'ok'} texto={mensagem} /> : null}
      <Button label={salvando ? t('notificacoes.salvando') : t('notificacoes.salvar')} desabilitado={salvando} onPress={() => void salvar()} />
    </Tela>
  );
}
