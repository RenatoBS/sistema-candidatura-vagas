import {
  baixarConteudoMidia,
  type ConversorAudio,
  type Armazenamento,
  type SttProvider,
  type WhatsappProvider,
} from '@scv/providers';
export const FILA_STT_TRANSCRICAO = 'stt-transcricao';
export interface RespostaAudio {
  id: string;
  empresaId: string;
  entrevistaId: string;
  mensagemIdProvedor: string;
  tokenInstancia?: string;
  audioUrl: string | null;
  transcricao: string | null;
  statusTranscricao: 'PENDENTE' | 'PROCESSANDO' | 'CONCLUIDA' | 'FALHA';
  revisaoHumanaNecessaria: boolean;
  duracaoSegundos?: number | null;
  confiancaTranscricao?: number | null;
}
export interface DependenciasAudio {
  buscarResposta(id: string): Promise<RespostaAudio | null>;
  atualizarResposta(id: string, patch: Partial<RespostaAudio>): Promise<void>;
  whatsapp: WhatsappProvider;
  armazenamento: Armazenamento;
  conversor: ConversorAudio;
  stt: SttProvider;
  limiarConfianca: number;
  fetchImpl?: typeof fetch;
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
      token: resposta.tokenInstancia ?? '',
      mensagemId: resposta.mensagemIdProvedor,
    });
    const original = await baixarConteudoMidia(midia, deps.fetchImpl);
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
      duracaoSegundos: Math.max(convertido.duracaoSegundos, resultado.duracaoSegundos),
      confiancaTranscricao: resultado.confianca,
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
