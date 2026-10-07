import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { criarSttProvider, FakeSttProvider, OpenAiWhisperStt } from './stt';
import { normalizarWebhookUazapi } from './uazapi-webhook';

describe('STT Whisper', () => {
  it('envia multipart e calcula confiança dos segmentos', async () => {
    let url = '';
    let init: RequestInit | undefined;
    const provider = new OpenAiWhisperStt(
      'https://api.test/v1',
      'secret',
      'whisper-1',
      async (input, options) => {
        url = String(input);
        init = options;
        return new Response(
          JSON.stringify({
            text: 'olá',
            duration: 4,
            segments: [
              { avg_logprob: 0, no_speech_prob: 0, duration: 2 },
              { avg_logprob: -0.693147, no_speech_prob: 0, duration: 2 },
            ],
          }),
        );
      },
    );
    const resposta = await provider.transcrever({
      audio: Buffer.from('audio'),
      mimetype: 'audio/ogg',
      idioma: 'pt',
    });
    assert.equal(url, 'https://api.test/v1/audio/transcriptions');
    assert.equal((init?.headers as Record<string, string>).authorization, 'Bearer secret');
    const form = init?.body as FormData;
    assert.equal(form.get('model'), 'whisper-1');
    assert.equal(form.get('language'), 'pt');
    assert.equal(form.get('response_format'), 'verbose_json');
    assert.equal(resposta.confianca > 0.7 && resposta.confianca < 0.8, true);
  });
  it('usa fake por padrão e OpenAI somente com configuração completa', () => {
    assert.equal(criarSttProvider({}).constructor, FakeSttProvider);
    assert.equal(criarSttProvider({ STT_PROVIDER: 'openai' }).constructor, FakeSttProvider);
    assert.equal(
      criarSttProvider({ STT_PROVIDER: 'openai', OPENAI_API_KEY: 'x' }).constructor,
      OpenAiWhisperStt,
    );
  });
});

describe('normalização do webhook Uazapi', () => {
  const base = {
    EventType: 'messages',
    message: {
      messageid: 'm1',
      sender: '5511900000001@s.whatsapp.net',
      messageType: 'Conversation',
      text: 'oi',
    },
  };
  it('normaliza texto, texto estendido, áudio, botão e imagem', () => {
    assert.equal(normalizarWebhookUazapi(base)?.tipo, 'TEXTO');
    assert.equal(
      normalizarWebhookUazapi({
        message: {
          ...base.message,
          messageid: 'm2',
          messageType: 'ExtendedTextMessage',
          content: 'texto',
        },
      })?.texto,
      'texto',
    );
    const audio = normalizarWebhookUazapi({
      message: {
        messageid: 'm3',
        sender: base.message.sender,
        messageType: 'AudioMessage',
        content: { seconds: 4, mimetype: 'audio/ogg' },
      },
    });
    assert.equal(audio?.tipo, 'AUDIO');
    assert.equal(audio?.duracaoSegundos, 4);
    assert.equal(audio?.mimetype, 'audio/ogg');
    assert.equal(
      normalizarWebhookUazapi({
        message: {
          messageid: 'm4',
          messageType: 'ButtonsResponseMessage',
          buttonOrListid: 'comecar',
        },
      })?.tipo,
      'BOTAO',
    );
    assert.equal(
      normalizarWebhookUazapi({
        message: { messageid: 'm5', messageType: 'ImageMessage', mediaType: 'image/jpeg' },
      })?.tipo,
      'MIDIA',
    );
  });
  it('marca eventos ignoráveis e rejeita payload sem id', () => {
    assert.equal(
      normalizarWebhookUazapi({ message: { ...base.message, fromMe: true } })?.deMim,
      true,
    );
    assert.equal(
      normalizarWebhookUazapi({ message: { ...base.message, wasSentByApi: true } })?.enviadaPelaApi,
      true,
    );
    assert.equal(
      normalizarWebhookUazapi({ message: { ...base.message, chatid: '123@g.us' } })?.grupo,
      true,
    );
    assert.equal(normalizarWebhookUazapi({ message: { text: 'sem id' } }), null);
  });
});
