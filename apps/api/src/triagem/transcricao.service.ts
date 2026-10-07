import { Inject, Injectable } from '@nestjs/common';
import {
  baixarConteudoMidia,
  decifrar,
  type Armazenamento,
  type ConversorAudio,
  type SttProvider,
  type WhatsappProvider,
} from '@scv/providers';
import type { ConfiguracaoApp } from '../configuracao';
import { ErroAplicacao } from '../erros';
import type { Repositorio } from '../repositorio/tipos';
import {
  ARMAZENAMENTO,
  CONFIG,
  CONVERSOR_AUDIO,
  REPOSITORIO,
  STT_PROVIDER,
  WHATSAPP_MENSAGENS,
} from '../tokens';

@Injectable()
export class TranscricaoService {
  constructor(
    @Inject(REPOSITORIO) private readonly repo: Repositorio,
    @Inject(CONFIG) private readonly config: ConfiguracaoApp,
    @Inject(WHATSAPP_MENSAGENS) private readonly whatsapp: WhatsappProvider,
    @Inject(ARMAZENAMENTO) private readonly armazenamento: Armazenamento,
    @Inject(CONVERSOR_AUDIO) private readonly conversor: ConversorAudio,
    @Inject(STT_PROVIDER) private readonly stt: SttProvider,
  ) {}

  async transcrever(respostaId: string): Promise<{ status: string }> {
    const existente = await this.repo.buscarResposta(respostaId, { sistema: true });
    if (!existente)
      throw new ErroAplicacao('RESPOSTA_NAO_ENCONTRADA', 404, 'resposta não encontrada');
    if (existente.statusTranscricao === 'CONCLUIDA') return { status: 'idempotente' };
    const instancia = await this.repo.buscarInstanciaPorEmpresa(existente.empresaId, {
      sistema: true,
    });
    if (!instancia || !existente.mensagemIdProvedor || !existente.entrevistaId)
      throw new ErroAplicacao('RESPOSTA_AUDIO_INVALIDA', 422, 'resposta de áudio sem origem');
    const token = decifrar(instancia.tokenCifrado, this.config.encryptionKey);
    await this.repo.guardarResposta({ ...existente, statusTranscricao: 'PROCESSANDO' });
    try {
      const midia = await this.whatsapp.baixarMidia({
        token,
        mensagemId: existente.mensagemIdProvedor,
      });
      const original = await baixarConteudoMidia(midia);
      const key = `empresas/${existente.empresaId}/entrevistas/${existente.entrevistaId}/respostas/${existente.id}.ogg`;
      await this.armazenamento.salvar(key, original, midia.mimetype ?? 'audio/ogg');
      const convertido = await this.conversor.converter(original, midia.mimetype ?? 'audio/ogg');
      const resultado = await this.stt.transcrever({
        audio: convertido.wav,
        mimetype: 'audio/wav',
        idioma: 'pt',
      });
      await this.repo.guardarResposta({
        ...existente,
        audioUrl: key,
        transcricao: resultado.texto,
        duracaoSegundos: Math.max(convertido.duracaoSegundos, resultado.duracaoSegundos),
        confiancaTranscricao: resultado.confianca,
        statusTranscricao: 'CONCLUIDA',
        revisaoHumanaNecessaria:
          resultado.confianca < Number(process.env.STT_LIMIAR_CONFIANCA ?? 0.6),
      });
    } catch (erro) {
      await this.repo.guardarResposta({
        ...existente,
        statusTranscricao: 'FALHA',
        revisaoHumanaNecessaria: true,
      });
      throw erro;
    }
    return { status: 'concluida' };
  }

  async marcarFalha(respostaId: string): Promise<{ status: string }> {
    const resposta = await this.repo.buscarResposta(respostaId, { sistema: true });
    if (!resposta)
      throw new ErroAplicacao('RESPOSTA_NAO_ENCONTRADA', 404, 'resposta não encontrada');
    await this.repo.guardarResposta({
      ...resposta,
      statusTranscricao: 'FALHA',
      revisaoHumanaNecessaria: true,
    });
    return { status: 'falha' };
  }
}
