import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { api, ErroApi } from '@/api/cliente';
import { Banner } from '@/design-system/Banner';
import { Button } from '@/design-system/Button';
import { Campo } from '@/design-system/Campo';
import { Tela } from '@/design-system/Tela';
import { chat, colors, radius, spacing, tipo } from '@/design-system/tokens';
import { textoDoRoteiro } from '@/dev/roteiro';

interface Opcao {
  id: string;
  titulo: string;
}

interface Saida {
  id: string;
  texto: string;
  opcoes: Opcao[];
}

interface Avaliacao {
  nota: number;
  justificativa: string;
}

interface Bolha {
  id: string;
  autor: 'empresa' | 'candidato';
  texto: string;
  opcoes: Opcao[];
}

const TELEFONE_SEED = '5511999990001';

export default function SimuladorWhatsappScreen() {
  const { t } = useTranslation();
  const [ativo, setAtivo] = useState<boolean | null>(null);
  const [telefone, setTelefone] = useState(TELEFONE_SEED);
  const [mensagem, setMensagem] = useState('');
  const [bolhas, setBolhas] = useState<Bolha[]>([]);
  const vistas = useRef(new Set<string>());
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([]);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [numeroAtivo, setNumeroAtivo] = useState('');
  const [indice, setIndice] = useState(0);
  const [ultimoTexto, setUltimoTexto] = useState<string | null>(null);

  useEffect(() => {
    void api<{ ativo: boolean }>('/dev/simulador/status')
      .then(() => setAtivo(true))
      .catch(() => setAtivo(false));
  }, []);

  useEffect(() => {
    if (!numeroAtivo) return;
    const id = setInterval(() => {
      void sincronizar(numeroAtivo);
    }, 1500);
    return () => clearInterval(id);
  }, [numeroAtivo]);

  function incorporar(saidas: Saida[]) {
    const novas = saidas.filter((item) => item.id && !vistas.current.has(item.id));
    if (novas.length === 0) return;
    for (const item of novas) vistas.current.add(item.id);
    setBolhas((atual) => [
      ...atual,
      ...novas.map((item) => ({ id: item.id, autor: 'empresa' as const, texto: item.texto, opcoes: item.opcoes })),
    ]);
  }

  async function sincronizar(numero: string) {
    try {
      const conversa = await api<{ mensagens: Saida[]; avaliacoes: Avaliacao[] }>(
        `/dev/simulador/conversa?numero=${encodeURIComponent(numero)}`,
      );
      incorporar(conversa.mensagens);
      setAvaliacoes(conversa.avaliacoes);
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : t('comum.erro'));
    }
  }

  async function iniciar() {
    setErro('');
    setOcupado(true);
    setBolhas([]);
    vistas.current = new Set();
    setAvaliacoes([]);
    setIndice(0);
    setUltimoTexto(null);
    try {
      const resposta = await api<{ numero: string; mensagens: Saida[]; motivo?: string }>('/dev/simulador/preparar', {
        method: 'POST',
        body: JSON.stringify({ numero: telefone }),
      });
      setNumeroAtivo(resposta.numero);
      incorporar(resposta.mensagens);
      if (resposta.motivo && resposta.motivo !== 'ja_existente') setErro(resposta.motivo);
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : t('comum.erro'));
    } finally {
      setOcupado(false);
    }
  }

  async function enviar(texto: string, botaoId?: string) {
    const limpo = texto.trim();
    if (!limpo || !numeroAtivo) return;
    setErro('');
    setOcupado(true);
    setBolhas((atual) => [...atual, { id: `local-${Date.now()}`, autor: 'candidato', texto: limpo, opcoes: [] }]);
    setMensagem('');
    if (!botaoId) setUltimoTexto(limpo);
    try {
      const resposta = await api<{ mensagens: Saida[] }>('/dev/simulador/entrada', {
        method: 'POST',
        body: JSON.stringify({ numero: numeroAtivo, texto: limpo, botaoId }),
      });
      incorporar(resposta.mensagens);
      void sincronizar(numeroAtivo);
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : t('comum.erro'));
    } finally {
      setOcupado(false);
    }
  }

  function usarRoteiro() {
    const ultima = [...bolhas].reverse().find((item) => item.autor === 'empresa');
    const acao = textoDoRoteiro({ ultimaSaida: ultima?.texto ?? '', indice, ultimoTextoEnviado: ultimoTexto });
    setIndice(acao.indice);
    void enviar(acao.texto);
  }

  const ultimaEmpresa = [...bolhas].reverse().find((item) => item.autor === 'empresa');
  const opcoes = ultimaEmpresa?.opcoes ?? [];

  return (
    <Tela teclado>
      <View style={styles.cabecalho}>
        <Text style={styles.titulo}>{t('simulador.titulo')}</Text>
        <Text style={styles.subtitulo}>{t('simulador.subtitulo')}</Text>
      </View>
      {ativo === false ? <Banner tipo="aviso" texto={t('simulador.desligado')} /> : null}
      {erro ? <Banner tipo="erro" texto={erro} /> : null}
      <Campo label={t('simulador.telefone')} value={telefone} onChangeText={setTelefone} autoCapitalize="none" keyboardType="number-pad" />
      <Button label={t('simulador.iniciar')} desabilitado={ocupado || ativo === false} onPress={() => void iniciar()} />
      <View style={styles.conversa}>
        {bolhas.map((bolha) => (
          <View key={bolha.id} style={[styles.bolha, bolha.autor === 'candidato' ? styles.enviada : styles.recebida]}>
            <Text style={styles.texto}>{bolha.texto}</Text>
          </View>
        ))}
        {numeroAtivo && bolhas.length === 0 ? <Text style={styles.espera}>{t('simulador.aguardando')}</Text> : null}
      </View>
      {opcoes.map((opcao) => (
        <Button key={opcao.id} label={opcao.titulo} variante="secundario" desabilitado={ocupado} onPress={() => void enviar(opcao.titulo, opcao.id)} />
      ))}
      <Campo label={t('simulador.mensagem')} value={mensagem} onChangeText={setMensagem} multiline />
      <Button label={t('simulador.enviar')} desabilitado={ocupado || !numeroAtivo} onPress={() => void enviar(mensagem)} />
      <Button label={t('simulador.roteiro')} variante="secundario" desabilitado={ocupado || !numeroAtivo} onPress={usarRoteiro} />
      {avaliacoes.length > 0 ? (
        <View style={styles.avaliacao}>
          <Text style={styles.avaliacaoTitulo}>{t('simulador.avaliacao')}</Text>
          {avaliacoes.map((item, posicao) => (
            <Text key={`${item.nota}-${posicao}`} style={styles.texto}>
              {t('simulador.nota', { n: item.nota })} — {item.justificativa}
            </Text>
          ))}
        </View>
      ) : null}
    </Tela>
  );
}

const styles = StyleSheet.create({
  cabecalho: { backgroundColor: chat.cabecalho, padding: spacing.md, borderRadius: radius.md, gap: spacing.xs },
  titulo: { ...tipo.secao, color: chat.textoCabecalho },
  subtitulo: { ...tipo.legenda, color: chat.textoCabecalho },
  conversa: { backgroundColor: chat.fundo, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm, minHeight: 220 },
  bolha: { maxWidth: '85%', padding: spacing.sm, borderRadius: radius.md },
  recebida: { alignSelf: 'flex-start', backgroundColor: chat.recebida },
  enviada: { alignSelf: 'flex-end', backgroundColor: chat.enviada },
  texto: { ...tipo.corpo, color: colors.text },
  espera: { ...tipo.legenda, color: colors.textMuted },
  avaliacao: { gap: spacing.sm },
  avaliacaoTitulo: { ...tipo.destaque, color: colors.text },
});
