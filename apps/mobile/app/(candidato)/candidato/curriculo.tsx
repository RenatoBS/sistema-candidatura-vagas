import * as DocumentPicker from 'expo-document-picker';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';

import { api, ErroApi } from '@/api/cliente';
import { useAuth } from '@/auth/AuthContext';
import { Banner } from '@/design-system/Banner';
import { Button } from '@/design-system/Button';
import { Cabecalho } from '@/design-system/Cabecalho';
import { Campo } from '@/design-system/Campo';
import { Cartao } from '@/design-system/Cartao';
import { Chip } from '@/design-system/Chip';
import { EstadoVazio } from '@/design-system/EstadoVazio';
import { estilos } from '@/design-system/estilos';
import { Tela } from '@/design-system/Tela';
import { formatarDataHora } from '@/formatacao/data';
import { useConsulta } from '@/hooks/useConsulta';
import { estadoRevisao, situacaoCurriculo } from '@/perfil/regras';

interface CurriculoResumo {
  id: string;
  statusProcessamento: string;
  metodoExtracao: 'NATIVO' | 'OCR' | 'MISTO' | null;
  baixaConfianca: boolean;
  aplicadoAoPerfil: boolean;
  criadoEm: string;
}

interface CurriculoResposta extends CurriculoResumo {
  textoExtraido: string | null;
  dadosExtraidos: {
    resumo?: string;
    experiencias?: { cargo: string; organizacao: string; inicio: string | null; fim: string | null }[];
    formacao?: { curso: string; instituicao: string }[];
    idiomas?: string[];
    habilidades?: { nome: string; nivel: number }[];
  } | null;
}

const MIME_PDF = 'application/pdf';
const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export default function CurriculoCandidato() {
  const { t } = useTranslation();
  const { accessToken } = useAuth();
  const lista = useConsulta(['curriculos'], () => api<CurriculoResumo[]>('/curriculos', {}, accessToken));
  const { refetch: recarregarLista } = lista;
  const [curriculo, setCurriculo] = useState<CurriculoResposta | null>(null);
  const [resumo, setResumo] = useState('');
  const [erro, setErro] = useState('');

  const emProcessamento =
    curriculo !== null && curriculo.statusProcessamento !== 'CONCLUIDO' && curriculo.statusProcessamento !== 'FALHA';

  // O processamento é assíncrono (worker): consulta até concluir ou falhar.
  useEffect(() => {
    if (!emProcessamento || !curriculo) return;
    const id = curriculo.id;
    const timer = setTimeout(() => {
      api<CurriculoResposta>(`/curriculos/${id}`, {}, accessToken)
        .then((detalhe) => {
          setCurriculo(detalhe);
          setResumo((atual) => atual || (detalhe.dadosExtraidos?.resumo ?? ''));
          if (detalhe.statusProcessamento === 'CONCLUIDO' || detalhe.statusProcessamento === 'FALHA') void recarregarLista();
        })
        .catch(() => setErro(t('comum.erro')));
    }, 2000);
    return () => clearTimeout(timer);
  }, [accessToken, curriculo, emProcessamento, recarregarLista, t]);

  async function abrir(id: string) {
    setErro('');
    try {
      const detalhe = await api<CurriculoResposta>(`/curriculos/${id}`, {}, accessToken);
      setCurriculo(detalhe);
      setResumo(detalhe.dadosExtraidos?.resumo ?? '');
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : t('comum.erro'));
    }
  }

  async function enviar() {
    setErro('');
    const escolha = await DocumentPicker.getDocumentAsync({
      type: [MIME_PDF, MIME_DOCX, 'image/png', 'image/jpeg'],
      copyToCacheDirectory: true,
    });
    if (escolha.canceled || !escolha.assets[0]) return;
    const arquivo = escolha.assets[0];
    const mime = arquivo.mimeType ?? MIME_PDF;
    const resposta = await fetch(arquivo.uri);
    const corpo = await resposta.blob();
    const pedido = await api<{ url: string; headers: Record<string, string>; arquivoKey: string }>(
      '/curriculos/upload-url',
      { method: 'POST', body: JSON.stringify({ mimeType: mime, tamanhoBytes: arquivo.size ?? corpo.size }) },
      accessToken,
    );
    const envio = await fetch(pedido.url, { method: 'PUT', headers: pedido.headers, body: corpo });
    if (!envio.ok) {
      setErro(t('comum.erro'));
      return;
    }
    const criado = await api<{ id: string }>(
      '/curriculos',
      {
        method: 'POST',
        body: JSON.stringify({ arquivoKey: pedido.arquivoKey, mimeType: mime, tamanhoBytes: arquivo.size ?? corpo.size }),
      },
      accessToken,
    );
    await abrir(criado.id);
    await lista.refetch();
  }

  async function confirmar() {
    if (!curriculo?.dadosExtraidos) return;
    const dados = {
      resumo,
      experiencias: (curriculo.dadosExtraidos.experiencias ?? []).map((item) => ({
        cargo: item.cargo,
        organizacao: item.organizacao,
        inicio: item.inicio,
        fim: item.fim,
      })),
      formacao: curriculo.dadosExtraidos.formacao ?? [],
      idiomas: curriculo.dadosExtraidos.idiomas ?? [],
      habilidades: curriculo.dadosExtraidos.habilidades ?? [],
    };
    const confirmado = await api<CurriculoResposta>(
      `/curriculos/${curriculo.id}/confirmar`,
      { method: 'POST', body: JSON.stringify({ dados }) },
      accessToken,
    );
    setCurriculo(confirmado);
    await lista.refetch();
  }

  const aviso = curriculo
    ? estadoRevisao({
        status: curriculo.statusProcessamento,
        baixaConfianca: curriculo.baixaConfianca,
        aplicadoAoPerfil: curriculo.aplicadoAoPerfil,
      })
    : null;
  const curriculos = lista.data ?? [];

  return (
    <Tela teclado>
      <Cabecalho titulo={t('candidato.curriculo')} subtitulo={t('candidato.uploadAjuda')} voltar />
      <Button label={t('candidato.enviarCurriculo')} onPress={() => void enviar().catch(() => setErro(t('comum.erro')))} />
      {erro ? <Banner tipo="erro" texto={erro} /> : null}
      {aviso ? (
        <Banner tipo={aviso === 'falha' ? 'erro' : aviso === 'aplicado' ? 'ok' : 'aviso'} texto={t(`candidato.estado.${aviso}`)} />
      ) : null}
      {curriculo?.textoExtraido ? <Text style={estilos.mudo}>{curriculo.textoExtraido}</Text> : null}
      {curriculo?.statusProcessamento === 'CONCLUIDO' ? (
        <>
          <Campo label={t('candidato.resumo')} value={resumo} onChangeText={setResumo} multiline />
          <Button label={t('candidato.confirmarDados')} onPress={() => void confirmar().catch(() => setErro(t('comum.erro')))} />
        </>
      ) : null}
      <Text style={estilos.tituloItem}>{t('candidato.curriculosEnviados')}</Text>
      {lista.isLoading ? <EstadoVazio titulo={t('comum.carregando')} /> : null}
      {lista.isError ? <EstadoVazio titulo={t('candidato.curriculosErro')} /> : null}
      {!lista.isLoading && !lista.isError && curriculos.length === 0 ? <EstadoVazio titulo={t('candidato.curriculosVazios')} /> : null}
      {curriculos.map((item) => {
        const situacao = situacaoCurriculo(item);
        return (
          <Cartao key={item.id} destaque={item.id === curriculo?.id}>
            <Chip texto={t(`candidato.statusCurriculo.${situacao}`)} />
            <Text style={estilos.legenda}>{t('candidato.enviadoEm', { data: formatarDataHora(item.criadoEm) ?? '—' })}</Text>
            {situacao === 'AGUARDANDO' && item.id !== curriculo?.id ? (
              <Button label={t('candidato.revisarCurriculo')} variante="secundario" onPress={() => void abrir(item.id)} />
            ) : null}
          </Cartao>
        );
      })}
    </Tela>
  );
}
