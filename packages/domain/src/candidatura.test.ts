import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  candidaturaTerminal,
  COMANDO_POR_EFEITO_VAGA,
  criarCandidatura,
  ESTADOS_TERMINAIS_CANDIDATURA,
  rotuloAmigavel,
  STATUS_CANDIDATURA,
  transicionarCandidatura,
  type ComandoCandidatura,
  type EstadoCandidatura,
  type StatusCandidatura,
} from './candidatura';
import { EFEITOS_EVENTO_VAGA } from './vaga';

const RH = '6f1d6c1e-0000-4000-8000-000000000001';

function estado(status: StatusCandidatura, statusAntesDaEspera: StatusCandidatura | null = null): EstadoCandidatura {
  return { status, statusAntesDaEspera };
}

function aplicar(status: StatusCandidatura, comando: ComandoCandidatura): StatusCandidatura {
  const resultado = transicionarCandidatura(estado(status), comando);
  assert.equal(resultado.ok, true, `${status} + ${comando.tipo}: ${JSON.stringify(resultado)}`);
  if (!resultado.ok) throw new Error('inalcançável');
  assert.equal(resultado.de, status);
  return resultado.estado.status;
}

function codigo(atual: EstadoCandidatura, comando: ComandoCandidatura): string | null {
  const resultado = transicionarCandidatura(atual, comando);
  return resultado.ok ? null : resultado.codigo;
}

const ATIVOS = STATUS_CANDIDATURA.filter((status) => !candidaturaTerminal(status));

describe('máquina de estados da candidatura', () => {
  it('cria por candidatura direta ou convite só com inscrições abertas', () => {
    const direta = criarCandidatura({ tipo: 'candidatarDireta', vagaAceitaInscricoes: true });
    assert.deepEqual(direta, { ok: true, de: null, estado: estado('INSCRITA') });
    const convite = criarCandidatura({ tipo: 'convidar', vagaAceitaInscricoes: true });
    assert.deepEqual(convite, { ok: true, de: null, estado: estado('CONVIDADA') });
    assert.deepEqual(criarCandidatura({ tipo: 'candidatarDireta', vagaAceitaInscricoes: false }), {
      ok: false,
      codigo: 'INSCRICOES_INDISPONIVEIS',
    });
  });

  it('convite: aceita com inscrições abertas, recusa ou expira', () => {
    assert.equal(aplicar('CONVIDADA', { tipo: 'aceitarConvite', vagaAceitaInscricoes: true }), 'INSCRITA');
    assert.equal(
      codigo(estado('CONVIDADA'), { tipo: 'aceitarConvite', vagaAceitaInscricoes: false }),
      'INSCRICOES_INDISPONIVEIS',
    );
    assert.equal(aplicar('CONVIDADA', { tipo: 'recusarConvite' }), 'CONVITE_EXPIRADO');
    assert.equal(aplicar('CONVIDADA', { tipo: 'expirarConvite' }), 'CONVITE_EXPIRADO');
    assert.equal(codigo(estado('INSCRITA'), { tipo: 'expirarConvite' }), 'TRANSICAO_INVALIDA');
    assert.equal(codigo(estado('CONVIDADA'), { tipo: 'desistir' }), 'TRANSICAO_INVALIDA');
  });

  it('percorre triagem, entrevista, revisão e contratação', () => {
    let status: StatusCandidatura = 'INSCRITA';
    status = aplicar(status, { tipo: 'iniciarTriagem' });
    assert.equal(status, 'TRIAGEM_WHATSAPP');
    status = aplicar(status, { tipo: 'concluirTriagem' });
    assert.equal(status, 'TRIAGEM_CONCLUIDA');
    status = aplicar(status, { tipo: 'iniciarEntrevistaVoz' });
    assert.equal(status, 'ENTREVISTA_VOZ');
    status = aplicar(status, { tipo: 'concluirEntrevista' });
    assert.equal(status, 'ENTREVISTA_CONCLUIDA');
    status = aplicar(status, { tipo: 'enviarRevisao' });
    assert.equal(status, 'EM_REVISAO');
    status = aplicar(status, { tipo: 'aprovar', autorHumanoId: RH });
    assert.equal(status, 'APROVADA');
    status = aplicar(status, { tipo: 'contratar', autorHumanoId: RH });
    assert.equal(status, 'CONTRATADA');
  });

  it('abandonos e falta de resposta só seguem para revisão humana', () => {
    assert.equal(aplicar('TRIAGEM_WHATSAPP', { tipo: 'abandonarTriagem' }), 'TRIAGEM_ABANDONADA');
    assert.equal(aplicar('TRIAGEM_WHATSAPP', { tipo: 'esgotarRetries' }), 'SEM_RESPOSTA');
    assert.equal(aplicar('ENTREVISTA_VOZ', { tipo: 'abandonarEntrevista' }), 'ENTREVISTA_ABANDONADA');
    for (const status of ['TRIAGEM_CONCLUIDA', 'TRIAGEM_ABANDONADA', 'SEM_RESPOSTA', 'ENTREVISTA_ABANDONADA'] as const) {
      assert.equal(aplicar(status, { tipo: 'enviarRevisao' }), 'EM_REVISAO');
    }
    assert.equal(codigo(estado('TRIAGEM_ABANDONADA'), { tipo: 'iniciarEntrevistaVoz' }), 'TRANSICAO_INVALIDA');
    assert.equal(codigo(estado('INSCRITA'), { tipo: 'concluirTriagem' }), 'TRANSICAO_INVALIDA');
  });

  it('não existe reprovação automática', () => {
    assert.equal(codigo(estado('EM_REVISAO'), { tipo: 'reprovar', autorHumanoId: '' }), 'DECISAO_HUMANA_OBRIGATORIA');
    assert.equal(codigo(estado('EM_REVISAO'), { tipo: 'aprovar', autorHumanoId: '  ' }), 'DECISAO_HUMANA_OBRIGATORIA');
    assert.equal(aplicar('EM_REVISAO', { tipo: 'reprovar', autorHumanoId: RH }), 'REPROVADA');
    for (const status of STATUS_CANDIDATURA.filter((item) => item !== 'EM_REVISAO')) {
      assert.notEqual(codigo(estado(status), { tipo: 'reprovar', autorHumanoId: RH }), null, status);
    }
    // Nenhum comando de sistema leva a REPROVADA.
    const sistema: ComandoCandidatura[] = [
      { tipo: 'concluirTriagem' },
      { tipo: 'abandonarTriagem' },
      { tipo: 'esgotarRetries' },
      { tipo: 'concluirEntrevista' },
      { tipo: 'abandonarEntrevista' },
      { tipo: 'concederExcecaoVoz' },
      { tipo: 'enviarRevisao' },
      { tipo: 'expirarConvite' },
      { tipo: 'pausarVaga' },
      { tipo: 'retomarVaga' },
      { tipo: 'fecharVaga' },
    ];
    for (const status of STATUS_CANDIDATURA) {
      for (const comando of sistema) {
        const resultado = transicionarCandidatura(estado(status, 'EM_REVISAO'), comando);
        if (resultado.ok) assert.notEqual(resultado.estado.status, 'REPROVADA', `${status} + ${comando.tipo}`);
      }
    }
  });

  it('candidato desiste de qualquer estado ativo inscrito', () => {
    for (const status of ATIVOS.filter((item) => item !== 'CONVIDADA')) {
      assert.equal(aplicar(status, { tipo: 'desistir' }), 'DESISTENCIA', status);
    }
  });

  it('estados terminais não saem', () => {
    assert.deepEqual(
      [...ESTADOS_TERMINAIS_CANDIDATURA].sort(),
      ['CONTRATADA', 'CONVITE_EXPIRADO', 'DESISTENCIA', 'ENCERRADA_VAGA_FECHADA', 'REPROVADA'],
    );
    for (const status of ESTADOS_TERMINAIS_CANDIDATURA) {
      assert.equal(codigo(estado(status), { tipo: 'fecharVaga' }), 'CANDIDATURA_ENCERRADA');
      assert.equal(codigo(estado(status), { tipo: 'pausarVaga' }), 'CANDIDATURA_ENCERRADA');
      assert.equal(codigo(estado(status), { tipo: 'desistir' }), 'CANDIDATURA_ENCERRADA');
    }
    assert.equal(candidaturaTerminal('TRIAGEM_ABANDONADA'), false);
  });

  it('vaga pausada guarda o estado anterior e a retomada volta exatamente a ele', () => {
    for (const status of ATIVOS.filter((item) => item !== 'EM_ESPERA')) {
      const pausada = transicionarCandidatura(estado(status), { tipo: 'pausarVaga' });
      assert.deepEqual(pausada, { ok: true, de: status, estado: estado('EM_ESPERA', status) });
      if (!pausada.ok) continue;
      const retomada = transicionarCandidatura(pausada.estado, { tipo: 'retomarVaga' });
      assert.deepEqual(retomada, { ok: true, de: 'EM_ESPERA', estado: estado(status) });
    }
  });

  it('pausa e retomada são idempotentes no nível do evento', () => {
    assert.equal(codigo(estado('EM_ESPERA', 'INSCRITA'), { tipo: 'pausarVaga' }), 'TRANSICAO_INVALIDA');
    assert.equal(codigo(estado('INSCRITA'), { tipo: 'retomarVaga' }), 'TRANSICAO_INVALIDA');
    assert.equal(codigo(estado('EM_ESPERA'), { tipo: 'retomarVaga' }), 'ESTADO_ANTERIOR_AUSENTE');
    assert.equal(codigo(estado('EM_ESPERA', 'REPROVADA'), { tipo: 'retomarVaga' }), 'ESTADO_ANTERIOR_AUSENTE');
  });

  it('em espera nada avança além de desistência e fechamento', () => {
    const espera = estado('EM_ESPERA', 'TRIAGEM_WHATSAPP');
    assert.equal(codigo(espera, { tipo: 'concluirTriagem' }), 'TRANSICAO_INVALIDA');
    assert.equal(codigo(espera, { tipo: 'esgotarRetries' }), 'TRANSICAO_INVALIDA');
    const desistiu = transicionarCandidatura(espera, { tipo: 'desistir' });
    assert.deepEqual(desistiu, { ok: true, de: 'EM_ESPERA', estado: estado('DESISTENCIA') });
  });

  it('vaga fechada encerra qualquer estado ativo, inclusive em espera', () => {
    for (const status of ATIVOS) {
      const anterior = status === 'EM_ESPERA' ? 'ENTREVISTA_VOZ' : null;
      const resultado = transicionarCandidatura(estado(status, anterior), { tipo: 'fecharVaga' });
      assert.deepEqual(resultado, { ok: true, de: status, estado: estado('ENCERRADA_VAGA_FECHADA') }, status);
    }
  });

  it('mapeia os efeitos dos eventos de vaga para comandos', () => {
    assert.equal(COMANDO_POR_EFEITO_VAGA[EFEITOS_EVENTO_VAGA.VagaPausada[0]!], 'pausarVaga');
    assert.equal(COMANDO_POR_EFEITO_VAGA[EFEITOS_EVENTO_VAGA.VagaRetomada[0]!], 'retomarVaga');
    assert.equal(COMANDO_POR_EFEITO_VAGA[EFEITOS_EVENTO_VAGA.VagaFechada[0]!], 'fecharVaga');
    assert.equal(COMANDO_POR_EFEITO_VAGA.SUSPENDER_RETRIES, undefined);
  });

  it('rótulo amigável em pt-BR para todos os estados, sem ranking', () => {
    assert.equal(rotuloAmigavel('TRIAGEM_WHATSAPP'), 'Triagem pelo WhatsApp');
    assert.equal(rotuloAmigavel('EM_REVISAO'), 'Em análise pela empresa');
    assert.equal(rotuloAmigavel('EM_ESPERA'), 'Processo pausado pela empresa');
    for (const status of STATUS_CANDIDATURA) {
      const rotulo = rotuloAmigavel(status);
      assert.ok(rotulo.length > 0, status);
      assert.equal(/\d|score|posi|ranking|percentil/i.test(rotulo), false, rotulo);
    }
  });
});
