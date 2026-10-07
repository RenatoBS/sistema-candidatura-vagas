import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ArmazenamentoMemoria,
  ConversorAudioFake,
  FakeSttProvider,
  FakeWhatsappProvider,
} from '@scv/providers';
import { processarAudioResposta } from './triagem-audio';
function deps(confidence = 1) {
  const resposta = {
    id: 'r1',
    empresaId: 'e1',
    entrevistaId: 'i1',
    mensagemIdProvedor: 'm1',
    audioUrl: null,
    transcricao: null,
    statusTranscricao: 'PENDENTE' as const,
    revisaoHumanaNecessaria: false,
  };
  const whatsapp = new FakeWhatsappProvider();
  whatsapp.programarMidia('m1', {
    base64: Buffer.from('audio').toString('base64'),
    mimetype: 'audio/ogg',
  });
  const armazenamento = new ArmazenamentoMemoria();
  const stt = new FakeSttProvider();
  if (confidence < 1)
    stt.transcrever = async () => ({
      texto: 'x',
      confianca: confidence,
      duracaoSegundos: 1,
      modelo: 'fake',
    });
  const updates: Partial<typeof resposta>[] = [];
  return {
    resposta,
    whatsapp,
    armazenamento,
    updates,
    deps: {
      buscarResposta: async () => resposta,
      atualizarResposta: async (_id: string, patch: Partial<typeof resposta>) => {
        Object.assign(resposta, patch);
        updates.push(patch);
      },
      whatsapp,
      armazenamento,
      conversor: new ConversorAudioFake(),
      stt,
      limiarConfianca: 0.6,
    },
  };
}
describe('pipeline de áudio', () => {
  it('baixa, salva, converte e transcreve', async () => {
    const item = deps();
    await processarAudioResposta({ respostaId: 'r1' }, item.deps);
    assert.equal(item.resposta.statusTranscricao, 'CONCLUIDA');
    assert.equal(item.resposta.audioUrl, 'empresas/e1/entrevistas/i1/respostas/r1.ogg');
    assert.deepEqual(await item.armazenamento.ler(item.resposta.audioUrl), Buffer.from('audio'));
  });
  it('marca baixa confiança para revisão e é idempotente', async () => {
    const item = deps(0.4);
    await processarAudioResposta({ respostaId: 'r1' }, item.deps);
    assert.equal(item.resposta.revisaoHumanaNecessaria, true);
    const total = item.updates.length;
    await processarAudioResposta({ respostaId: 'r1' }, item.deps);
    assert.equal(item.updates.length, total);
  });
  it('marca falha em download e STT', async () => {
    const item = deps();
    item.whatsapp.falhar = true;
    await assert.rejects(() => processarAudioResposta({ respostaId: 'r1' }, item.deps));
    assert.equal(item.resposta.statusTranscricao, 'FALHA');
  });
});
