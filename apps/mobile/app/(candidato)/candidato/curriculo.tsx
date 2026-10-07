import * as DocumentPicker from 'expo-document-picker';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';

import { api } from '@/api/cliente';
import { useAuth } from '@/auth/AuthContext';
import { Banner } from '@/design-system/Banner';
import { Button } from '@/design-system/Button';
import { Cabecalho } from '@/design-system/Cabecalho';
import { Campo } from '@/design-system/Campo';
import { estilos } from '@/design-system/estilos';
import { Tela } from '@/design-system/Tela';
import { estadoRevisao } from '@/perfil/regras';

interface CurriculoResposta {
  id: string;
  statusProcessamento: string;
  metodoExtracao: 'NATIVO' | 'OCR' | 'MISTO' | null;
  baixaConfianca: boolean;
  aplicadoAoPerfil: boolean;
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
  const [curriculo, setCurriculo] = useState<CurriculoResposta | null>(null);
  const [resumo, setResumo] = useState('');
  const [erro, setErro] = useState('');

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
    const detalhe = await api<CurriculoResposta>(`/curriculos/${criado.id}`, {}, accessToken);
    setCurriculo(detalhe);
    setResumo(detalhe.dadosExtraidos?.resumo ?? '');
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
  }

  const aviso = curriculo
    ? estadoRevisao({
        status: curriculo.statusProcessamento,
        baixaConfianca: curriculo.baixaConfianca,
        aplicadoAoPerfil: curriculo.aplicadoAoPerfil,
      })
    : null;

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
    </Tela>
  );
}
