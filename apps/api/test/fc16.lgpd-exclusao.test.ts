import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, describe, it } from 'node:test';

import {
  api,
  armazenamentoTeste,
  conta,
  derrubarApp,
  interno,
  limparAmbienteTeste,
  pushTeste,
  repositorioTeste,
  SENHA,
  subirApp,
} from './ajuda-http';

const SISTEMA = { sistema: true as const };
const KEYS = { audio: 'respostas/audio-candidato.ogg', gravacao: 'gravacoes/sessao-candidato.webm', cv: 'curriculos/cv-candidato.pdf' };

async function candidatoComDados(email: string) {
  const access = await conta(email);
  const onboard = await api('/onboarding/candidato', { method: 'POST', body: JSON.stringify({ nome: 'Pessoa Fixture' }) }, access);
  assert.equal(onboard.status, 201);
  const token = String(onboard.json.accessToken);
  const perfil = await api('/candidatos/me', {}, token);
  const candidatoId = String(perfil.json.id);
  const usuario = await repositorioTeste.buscarUsuarioPorEmail(email);
  assert.ok(usuario);

  const empresaId = randomUUID();
  const vagaId = randomUUID();
  const candidaturaId = randomUUID();
  const entrevistaId = randomUUID();
  const respostaId = randomUUID();
  const agora = new Date();
  await repositorioTeste.criarCandidatura(
    { id: candidaturaId, empresaId, vagaId, candidatoId, origem: 'DIRETA', status: 'TRIAGEM_CONCLUIDA', statusAntesDaEspera: null, etapaAtualId: null, criadoEm: agora, atualizadoEm: agora },
    { id: randomUUID(), candidaturaId, de: 'INSCRITA', para: 'TRIAGEM_CONCLUIDA', autorId: null, motivo: null, criadoEm: agora },
    SISTEMA,
  );
  await repositorioTeste.criarEntrevista(
    { id: entrevistaId, empresaId, candidaturaId, etapaId: randomUUID(), canal: 'VOZ_TEMPO_REAL', status: 'CONCLUIDA', retryAtual: 0, perguntaAtual: 0, iniciadaEm: agora, ultimaInteracaoEm: agora, proximoRetryEm: null, aceiteTentativaEm: null, excecaoConcedida: false, encerrarAoFim: false, contexto: {}, criadoEm: agora, atualizadoEm: agora },
    SISTEMA,
  );
  await armazenamentoTeste.salvar(KEYS.audio, Buffer.from('audio'), 'audio/ogg');
  await armazenamentoTeste.salvar(KEYS.gravacao, Buffer.from('gravacao'), 'video/webm');
  await armazenamentoTeste.salvar(KEYS.cv, Buffer.from('cv'), 'application/pdf');
  await repositorioTeste.guardarResposta({ id: respostaId, empresaId, entrevistaId, etapaPerguntaId: randomUUID(), tipo: 'AUDIO_WHATSAPP', textoOriginal: 'texto do candidato', audioUrl: KEYS.audio, transcricao: 'transcrição do candidato', statusTranscricao: 'CONCLUIDA' });
  await repositorioTeste.salvarAvaliacao({ id: randomUUID(), respostaId, avaliador: 'IA', nota: 8, criterios: { clareza: 8 }, justificativa: 'cita a fala do candidato', modelo: 'm', versaoPrompt: 'v', criadoEm: agora }, SISTEMA);
  await repositorioTeste.criarSessaoVoz({ id: randomUUID(), entrevistaId, salaId: 'sala-x', status: 'CONCLUIDA', inicioEm: agora, fimEm: agora, desconectadoEm: null, motivoFim: null, gravacaoKey: KEYS.gravacao, criadoEm: agora, atualizadoEm: agora } as never, SISTEMA);
  await repositorioTeste.criarCurriculo({ id: randomUUID(), candidatoId, arquivoKey: KEYS.cv, mimeType: 'application/pdf', tamanhoBytes: 2, antivirusStatus: 'LIMPO', metodoExtracao: 'NATIVO', statusProcessamento: 'CONCLUIDO', confiancaOcr: null, textoExtraido: 'cv', dadosExtraidos: null, confirmadoEm: null, aplicadoAoPerfil: false, paginas: null, criadoEm: agora, atualizadoEm: agora } as never);
  repositorioTeste.matchStore.embeddingsCandidato.set(candidatoId, [0.1, 0.2]);
  await repositorioTeste.registrarDispositivoPush({ usuarioId: usuario.id, token: 'tok-push-1', plataforma: 'ANDROID', ultimoUsoEm: agora });
  return { token, usuarioId: usuario.id, candidatoId, respostaId, entrevistaId };
}

describe('FC-16 — exclusão LGPD completa', () => {
  before(subirApp);
  after(derrubarApp);
  beforeEach(limparAmbienteTeste);

  it('expurga transcrições e embeddings na hora e apaga áudios no job assíncrono, idempotente, com relatório', async () => {
    const dados = await candidatoComDados('lgpd16@pessoal.test');
    const reauth = await api('/auth/reautenticar', { method: 'POST', body: JSON.stringify({ senha: SENHA }) }, dados.token);
    const exclusao = await api(
      '/lgpd/excluir',
      { method: 'POST', headers: { 'x-reauth-token': String(reauth.json.reauthToken) }, body: JSON.stringify({ confirmacao: 'EXCLUIR' }) },
      dados.token,
    );
    assert.equal(exclusao.status, 200, JSON.stringify(exclusao.json));
    assert.equal(exclusao.json.status, 'PENDENTE');
    const solicitacaoId = String(exclusao.json.solicitacaoId);

    // Imediato: nenhuma transcrição/embedding/justificativa/dispositivo do candidato permanece.
    const resposta = await repositorioTeste.buscarResposta(dados.respostaId, SISTEMA);
    assert.equal(resposta?.transcricao, null);
    assert.equal(resposta?.textoOriginal, null);
    assert.equal(resposta?.audioUrl, null);
    assert.equal(repositorioTeste.matchStore.embeddingsCandidato.has(dados.candidatoId), false);
    const avaliacoes = await repositorioTeste.listarAvaliacoes(dados.respostaId, SISTEMA);
    assert.equal(avaliacoes.every((item) => item.justificativa === null), true);
    assert.deepEqual(await repositorioTeste.listarDispositivosPush(dados.usuarioId), []);
    assert.equal((await repositorioTeste.listarCurriculos(dados.candidatoId)).length, 0);
    // Os objetos no bucket só saem no job.
    for (const key of Object.values(KEYS)) assert.ok(await armazenamentoTeste.ler(key), `${key} ainda deve existir antes do job`);

    const job = await interno(`/interno/lgpd/exclusoes/${solicitacaoId}/processar`);
    assert.equal(job.status, 200, JSON.stringify(job.json));
    assert.equal(job.json.concluida, true);
    for (const key of Object.values(KEYS)) assert.equal(await armazenamentoTeste.ler(key), null, `${key} deveria ter sido apagado`);
    const relatorio = job.json.relatorio as Record<string, number>;
    assert.equal(relatorio.arquivosRemovidos, 3);
    assert.equal(relatorio.respostasLimpas, 1);
    assert.equal(relatorio.embeddingsRemovidos, 1);
    assert.equal(JSON.stringify(job.json).includes('pessoa'), false, 'relatório não carrega PII');

    // Idempotente: reprocessar não muda nada nem falha.
    const de_novo = await interno(`/interno/lgpd/exclusoes/${solicitacaoId}/processar`);
    assert.equal(de_novo.status, 200);
    assert.equal(de_novo.json.concluida, true);
    assert.deepEqual(de_novo.json.relatorio, relatorio);
  });

  it('falha do storage mantém a solicitação pendente (job repete) e a próxima rodada conclui só o que falta', async () => {
    const dados = await candidatoComDados('lgpd16b@pessoal.test');
    const reauth = await api('/auth/reautenticar', { method: 'POST', body: JSON.stringify({ senha: SENHA }) }, dados.token);
    const exclusao = await api(
      '/lgpd/excluir',
      { method: 'POST', headers: { 'x-reauth-token': String(reauth.json.reauthToken) }, body: JSON.stringify({ confirmacao: 'EXCLUIR' }) },
      dados.token,
    );
    const solicitacaoId = String(exclusao.json.solicitacaoId);
    const apagar = armazenamentoTeste.apagar.bind(armazenamentoTeste);
    armazenamentoTeste.apagar = async (key: string) => {
      if (key === KEYS.gravacao) throw new Error('storage indisponível');
      return apagar(key);
    };
    try {
      const parcial = await interno(`/interno/lgpd/exclusoes/${solicitacaoId}/processar`);
      assert.equal(parcial.json.concluida, false);
      assert.equal(await armazenamentoTeste.ler(KEYS.audio), null);
      assert.ok(await armazenamentoTeste.ler(KEYS.gravacao));
    } finally {
      armazenamentoTeste.apagar = apagar;
    }
    const final = await interno(`/interno/lgpd/exclusoes/${solicitacaoId}/processar`);
    assert.equal(final.json.concluida, true);
    assert.equal(await armazenamentoTeste.ler(KEYS.gravacao), null);
    void pushTeste;
  });

  it('a rota interna exige o token interno', async () => {
    const sem = await api(`/interno/lgpd/exclusoes/${randomUUID()}/processar`, { method: 'POST' });
    assert.equal(sem.status, 401);
  });
});
