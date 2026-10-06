import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  aceitaInscricoes,
  deveAlertarPausaLonga,
  EFEITOS_EVENTO_VAGA,
  formatarInstanteBrasilia,
  interpretarPrazo,
  POLITICA_RETRY_PADRAO,
  processoPublicavel,
  tempoLimiteEfetivo,
  transicionarVaga,
  type EstadoVaga,
} from './vaga';

const agora = new Date('2026-10-06T15:00:00.000Z');
const futuro = new Date('2026-11-21T02:59:00.000Z');
const depois = new Date('2026-12-01T02:59:00.000Z');

function estado(parcial: Partial<EstadoVaga> = {}): EstadoVaga {
  return {
    status: 'RASCUNHO',
    prazoInscricoes: null,
    statusAntesDaPausa: null,
    inscricoesEncerradasEm: null,
    pausadaEm: null,
    fechadaEm: null,
    motivoFechamento: null,
    alertaPausaEm: null,
    ...parcial,
  };
}

describe('ciclo de vida da vaga', () => {
  it('aceita rascunho sem prazo e recusa publicar sem prazo futuro', () => {
    const semPrazo = transicionarVaga(estado(), { tipo: 'publicar', prazo: new Date(NaN), empresaVerificada: true }, agora);
    assert.equal(semPrazo.ok, false);
    const passado = transicionarVaga(
      estado(),
      { tipo: 'publicar', prazo: new Date('2026-10-01T00:00:00.000Z'), empresaVerificada: true },
      agora,
    );
    assert.equal(passado.ok, false);
    if (!passado.ok) assert.equal(passado.codigo, 'PRAZO_NO_PASSADO');
    const empresa = transicionarVaga(estado(), { tipo: 'publicar', prazo: futuro, empresaVerificada: false }, agora);
    assert.equal(empresa.ok, false);
    if (!empresa.ok) assert.equal(empresa.codigo, 'EMPRESA_NAO_VERIFICADA');
  });

  it('publica, encerra no prazo e só reabre por prorrogação', () => {
    const publicada = transicionarVaga(estado(), { tipo: 'publicar', prazo: futuro, empresaVerificada: true }, agora);
    assert.equal(publicada.ok, true);
    if (!publicada.ok) return;
    assert.equal(aceitaInscricoes(publicada.estado, agora), true);
    const cedo = transicionarVaga(publicada.estado, { tipo: 'expirar' }, agora);
    assert.equal(cedo.ok, false);
    const encerrada = transicionarVaga(publicada.estado, { tipo: 'expirar' }, new Date(futuro.getTime() + 1000));
    assert.equal(encerrada.ok, true);
    if (!encerrada.ok) return;
    assert.equal(encerrada.estado.status, 'INSCRICOES_ENCERRADAS');
    assert.equal(aceitaInscricoes(encerrada.estado, new Date(futuro.getTime() + 1000)), false);
    const reaberta = transicionarVaga(encerrada.estado, { tipo: 'prorrogar', prazo: depois }, new Date(futuro.getTime() + 1000));
    assert.equal(reaberta.ok, true);
    if (!reaberta.ok) return;
    assert.equal(reaberta.estado.status, 'PUBLICADA');
    assert.equal(reaberta.estado.inscricoesEncerradasEm, null);
  });

  it('não congela o prazo na pausa e retoma conforme o relógio', () => {
    const publicada = transicionarVaga(estado({ prazoInscricoes: futuro }), { tipo: 'publicar', prazo: futuro, empresaVerificada: true }, agora);
    assert.equal(publicada.ok, true);
    if (!publicada.ok) return;
    const pausada = transicionarVaga(publicada.estado, { tipo: 'pausar' }, agora);
    assert.equal(pausada.ok, true);
    if (!pausada.ok) return;
    assert.equal(pausada.evento, 'VagaPausada');
    assert.equal(pausada.estado.prazoInscricoes?.toISOString(), futuro.toISOString());
    assert.deepEqual(EFEITOS_EVENTO_VAGA.VagaPausada, ['EM_ESPERA', 'SUSPENDER_RETRIES']);
    const retomada = transicionarVaga(pausada.estado, { tipo: 'retomar' }, agora);
    assert.equal(retomada.ok, true);
    if (!retomada.ok) return;
    assert.equal(retomada.estado.status, 'PUBLICADA');
    const vencida = transicionarVaga(pausada.estado, { tipo: 'retomar' }, new Date(futuro.getTime() + 1000));
    assert.equal(vencida.ok, true);
    if (!vencida.ok) return;
    assert.equal(vencida.estado.status, 'INSCRICOES_ENCERRADAS');
  });

  it('alerta pausa longa sem fechar e trata fechamento como terminal', () => {
    const pausada = estado({
      status: 'PAUSADA',
      prazoInscricoes: futuro,
      pausadaEm: new Date('2026-09-01T00:00:00.000Z'),
      statusAntesDaPausa: 'PUBLICADA',
    });
    assert.equal(deveAlertarPausaLonga(pausada, new Date('2026-10-02T00:00:00.000Z'), 30), true);
    assert.equal(pausada.status, 'PAUSADA');
    const fechada = transicionarVaga(pausada, { tipo: 'fechar', motivo: '  vaga encerrada  ' }, agora);
    assert.equal(fechada.ok, true);
    if (!fechada.ok) return;
    assert.equal(fechada.estado.status, 'FECHADA');
    assert.equal(fechada.estado.motivoFechamento, 'vaga encerrada');
    assert.deepEqual(EFEITOS_EVENTO_VAGA.VagaFechada, ['ENCERRADA_VAGA_FECHADA', 'CANCELAR_RETRIES']);
    const reabrir = transicionarVaga(fechada.estado, { tipo: 'prorrogar', prazo: depois }, agora);
    assert.equal(reabrir.ok, false);
    if (!reabrir.ok) assert.equal(reabrir.codigo, 'VAGA_FECHADA');
    const semMotivo = transicionarVaga(pausada, { tipo: 'fechar', motivo: ' ' }, agora);
    assert.equal(semMotivo.ok, false);
  });

  it('exige perguntas completas e respeita a precedência do tempo', () => {
    assert.equal(processoPublicavel([{ numeroPerguntas: 5, aprovadas: 5, pendentes: 0 }]), true);
    assert.equal(processoPublicavel([{ numeroPerguntas: 5, aprovadas: 2, pendentes: 3 }]), false);
    assert.equal(tempoLimiteEfetivo({ etapaPerguntaSegundos: 45, perguntaSegundos: 90, processoSegundos: 180 }), 45);
    assert.equal(tempoLimiteEfetivo({ etapaPerguntaSegundos: null, perguntaSegundos: 90, processoSegundos: 180 }), 90);
    assert.equal(tempoLimiteEfetivo({ etapaPerguntaSegundos: null, perguntaSegundos: null, processoSegundos: 180 }), 180);
    assert.equal(POLITICA_RETRY_PADRAO.tentativas, 3);
  });

  it('mostra o prazo em America/Sao_Paulo', () => {
    const prazo = interpretarPrazo('2026-11-20T23:59');
    assert.ok(prazo);
    assert.equal(prazo?.toISOString(), '2026-11-21T02:59:00.000Z');
    assert.match(formatarInstanteBrasilia(prazo!), /20\/11\/2026.*23:59/);
  });
});
