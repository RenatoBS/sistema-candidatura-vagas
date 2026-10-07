import type { ConversorAudio, Armazenamento, SttProvider, WhatsappProvider } from '@scv/providers';
export const FILA_STT_TRANSCRICAO = 'stt-transcricao';
export interface RespostaAudio {
  id: string;
  empresaId: string;
  entrevistaId: string;
  mensagemIdProvedor: string;
  audioUrl: string | null;
  transcricao: string | null;
  statusTranscricao: 'PENDENTE' | 'PROCESSANDO' | 'CONCLUIDA' | 'FALHA';
  revisaoHumanaNecessaria: boolean;
}
export interface DependenciasAudio {
  buscarResposta(id: string): Promise<RespostaAudio | null>;
  atualizarResposta(id: string, patch: Partial<RespostaAudio>): Promise<void>;
  whatsapp: WhatsappProvider;
  armazenamento: Armazenamento;
  conversor: ConversorAudio;
  stt: SttProvider;
  limiarConfianca: number;
  aoConcluirTranscricao?: (respostaId: string) => Promise<void>;
}
export async function processarAudioResposta(
  args: { respostaId: string },
  deps: DependenciasAudio,
): Promise<void> {
  const resposta = await deps.buscarResposta(args.respostaId);
  if (!resposta || resposta.statusTranscricao === 'CONCLUIDA') return;
  await deps.atualizarResposta(resposta.id, { statusTranscricao: 'PROCESSANDO' });
  try {
    const midia = await deps.whatsapp.baixarMidia({
      token: '',
      mensagemId: resposta.mensagemIdProvedor,
    });
    const original = midia.base64
      ? Buffer.from(midia.base64, 'base64')
      : midia.url
        ? await (
            deps.whatsapp as WhatsappProvider & { baixarBuffer?: (url: string) => Promise<Buffer> }
          ).baixarBuffer?.(midia.url)
        : undefined;
    if (!original) throw new Error('AUDIO_NAO_ENCONTRADO');
    const key = `empresas/${resposta.empresaId}/entrevistas/${resposta.entrevistaId}/respostas/${resposta.id}.ogg`;
    await deps.armazenamento.salvar(key, original, midia.mimetype ?? 'audio/ogg');
    const convertido = await deps.conversor.converter(original, midia.mimetype ?? 'audio/ogg');
    const resultado = await deps.stt.transcrever({
      audio: convertido.wav,
      mimetype: 'audio/wav',
      idioma: 'pt',
    });
    await deps.atualizarResposta(resposta.id, {
      audioUrl: key,
      transcricao: resultado.texto,
      statusTranscricao: 'CONCLUIDA',
      revisaoHumanaNecessaria: resultado.confianca < deps.limiarConfianca,
    });
    await deps.aoConcluirTranscricao?.(resposta.id);
  } catch (erro) {
    await deps.atualizarResposta(resposta.id, {
      statusTranscricao: 'FALHA',
      revisaoHumanaNecessaria: true,
    });
    throw erro;
  }
}
