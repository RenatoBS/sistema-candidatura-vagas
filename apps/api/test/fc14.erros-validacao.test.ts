import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, describe, it } from 'node:test';

import { Logger, type ArgumentsHost } from '@nestjs/common';

import { FiltroErros } from '../src/http/filtro-erros';
import {
  api,
  CNPJ_A,
  conta,
  criarVagaComProcesso,
  derrubarApp,
  empresaVerificada,
  limparAmbienteTeste,
  repositorioTeste,
  subirApp,
} from './ajuda-http';

const SISTEMA = { sistema: true as const };

function anfitriao(requisicao: Record<string, unknown> = {}) {
  const respondido: { status?: number; corpo?: unknown } = {};
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({
        status(codigo: number) {
          respondido.status = codigo;
          return { json: (corpo: unknown) => void (respondido.corpo = corpo) };
        },
      }),
      getRequest: () => requisicao,
    }),
  } as unknown as ArgumentsHost;
  return { host, respondido };
}

describe('FC-14 — erros e validação da API', () => {
  before(subirApp);
  after(derrubarApp);
  beforeEach(limparAmbienteTeste);

  it('V1/V2: UUID malformado nos parâmetros é 400 e membro inexistente é 404', async () => {
    const empresa = await empresaVerificada(await conta('v1@pessoal.test'), CNPJ_A, 'Acme');
    const remover = (membroId: string) =>
      api(`/empresas/${empresa.empresaId}/membros/${membroId}/remover`, { method: 'POST' }, empresa.token);
    assert.equal((await remover('nao-e-uuid')).status, 400);
    assert.equal((await remover(randomUUID())).status, 404);
    assert.equal((await api('/vagas-publicas/xyz')).status, 400);
    assert.equal((await api(`/empresas/xyz/membros`, {}, empresa.token)).status, 400);
    assert.equal((await api(`/vagas-publicas/${randomUUID()}`)).status, 404);
  });

  it('400 de validação informa quais campos falharam, sem ecoar os valores', async () => {
    const empresa = await empresaVerificada(await conta('campos@pessoal.test'), CNPJ_A, 'Acme');
    const resposta = await api(
      `/empresas/${empresa.empresaId}/vagas`,
      { method: 'POST', body: JSON.stringify({ titulo: 'Back', descricao: 'Teste', senioridade: 'SENIOR', modelo: 'REMOTO' }) },
      empresa.token,
    );
    assert.equal(resposta.status, 400);
    assert.equal(resposta.json.codigo, 'DADOS_INVALIDOS');
    assert.deepEqual(resposta.json.detalhes, { campos: ['descricao'] });
    assert.equal(JSON.stringify(resposta.json).includes('Teste'), false);
  });

  it('V2: filtros de vagas públicas com enum inválido são 400', async () => {
    assert.equal((await api('/vagas-publicas?senioridade=GIGANTE')).status, 400);
    assert.equal((await api('/vagas-publicas?modelo=NAVE')).status, 400);
    assert.equal((await api('/vagas-publicas?senioridade=PLENO&modelo=REMOTO')).status, 200);
  });

  it('V4: o último administrador ativo não pode ser removido; havendo outro, pode', async () => {
    const empresa = await empresaVerificada(await conta('v4@pessoal.test'), CNPJ_A, 'Acme');
    const membros = await repositorioTeste.listarMembros(empresa.empresaId, SISTEMA);
    const admin = membros.find((membro) => membro.papeis.includes('ADMIN_EMPRESA'));
    assert.ok(admin);
    const remover = (membroId: string) =>
      api(`/empresas/${empresa.empresaId}/membros/${membroId}/remover`, { method: 'POST' }, empresa.token);
    const negado = await remover(admin.id);
    assert.equal(negado.status, 409, JSON.stringify(negado.json));
    assert.equal(negado.json.codigo, 'ULTIMO_ADMIN');

    const outraConta = await conta('v4-outro@pessoal.test');
    assert.ok(outraConta);
    const outroUsuario = await repositorioTeste.buscarUsuarioPorEmail('v4-outro@pessoal.test');
    await repositorioTeste.criarMembro(
      { id: randomUUID(), usuarioId: outroUsuario!.id, empresaId: empresa.empresaId, papeis: ['ADMIN_EMPRESA'], status: 'ATIVO' },
      SISTEMA,
    );
    assert.equal((await remover(admin.id)).status, 201);
  });

  it('V6: publicar vaga FECHADA é 409 VAGA_FECHADA, mesmo com o processo incompleto', async () => {
    const empresa = await empresaVerificada(await conta('v6@pessoal.test'), CNPJ_A, 'Acme');
    const { vagaId } = await criarVagaComProcesso(empresa.empresaId, empresa.token, [{ tipo: 'ENTREVISTA_VOZ', numeroPerguntas: 2 }]);
    const fechada = await api(
      `/empresas/${empresa.empresaId}/vagas/${vagaId}/fechar`,
      { method: 'POST', body: JSON.stringify({ motivo: 'sem orçamento' }) },
      empresa.token,
    );
    assert.equal(fechada.status, 201, JSON.stringify(fechada.json));
    const publicar = await api(`/empresas/${empresa.empresaId}/vagas/${vagaId}/publicar`, { method: 'POST' }, empresa.token);
    assert.equal(publicar.status, 409);
    assert.equal(publicar.json.codigo, 'VAGA_FECHADA');
  });

  it('V7: completudeMin fora de [0,1] é 400', async () => {
    const empresa = await empresaVerificada(await conta('v7@pessoal.test'), CNPJ_A, 'Acme');
    const { vagaId } = await criarVagaComProcesso(empresa.empresaId, empresa.token, [{ tipo: 'ENTREVISTA_VOZ', numeroPerguntas: 1 }]);
    const ranking = (consulta: string) =>
      api(`/empresas/${empresa.empresaId}/vagas/${vagaId}/ranking${consulta}`, {}, empresa.token);
    for (const invalido of ['?completudeMin=2', '?completudeMin=-0.1', '?completudeMin=abc']) {
      assert.equal((await ranking(invalido)).status, 400, invalido);
    }
    assert.equal((await ranking('?completudeMin=0.5')).status, 200);
    assert.equal((await ranking('')).status, 200);
  });

  it('V5: exceção em entrevista concluída é 409 (e em entrevista inexistente, 404)', async () => {
    const empresa = await empresaVerificada(await conta('v5@pessoal.test'), CNPJ_A, 'Acme');
    const entrevistaId = randomUUID();
    const agora = new Date();
    await repositorioTeste.criarEntrevista(
      {
        id: entrevistaId,
        empresaId: empresa.empresaId,
        candidaturaId: randomUUID(),
        etapaId: randomUUID(),
        canal: 'VOZ_TEMPO_REAL',
        status: 'CONCLUIDA',
        retryAtual: 0,
        perguntaAtual: 0,
        iniciadaEm: agora,
        ultimaInteracaoEm: agora,
        proximoRetryEm: null,
        aceiteTentativaEm: null,
        excecaoConcedida: false,
        encerrarAoFim: false,
        contexto: {},
        criadoEm: agora,
        atualizadoEm: agora,
      },
      SISTEMA,
    );
    const excecao = (id: string) =>
      api(`/empresas/${empresa.empresaId}/voz/${id}/excecao`, { method: 'POST', body: JSON.stringify({ motivo: 'instabilidade' }) }, empresa.token);
    const concluida = await excecao(entrevistaId);
    assert.equal(concluida.status, 409, JSON.stringify(concluida.json));
    assert.equal(concluida.json.codigo, 'ESTADO_INVALIDO');
    assert.equal((await excecao(randomUUID())).status, 404);
  });
});

describe('FC-14/V3 — filtro global de erros', () => {
  it('500 registra a exceção original com id de correlação, sem a mensagem, e devolve o mesmo id', () => {
    const linhas: unknown[][] = [];
    Logger.overrideLogger({ log() {}, warn() {}, error: (...args: unknown[]) => void linhas.push(args) } as never);
    const { host, respondido } = anfitriao({ id: 'req-123', method: 'GET', route: { path: '/vagas/:vagaId' } });
    const original = new Error('violação em joao@exemplo.com');
    new FiltroErros().catch(original, host);
    Logger.overrideLogger(false);
    assert.equal(respondido.status, 500);
    assert.deepEqual(respondido.corpo, { codigo: 'ERRO_INTERNO', mensagem: 'erro interno', correlacaoId: 'req-123' });
    assert.equal(linhas.length, 1);
    const registro = JSON.stringify(linhas[0]);
    assert.match(registro, /req-123/);
    assert.match(registro, /"erro":"Error"/);
    assert.match(registro, /\/vagas\/:vagaId/);
    assert.equal(registro.includes('joao@exemplo.com'), false, 'mensagem com PII não pode ir para o log');
  });

  it('gera id de correlação quando a requisição não tem um', () => {
    Logger.overrideLogger(false);
    const { host, respondido } = anfitriao();
    new FiltroErros().catch(new Error('x'), host);
    assert.match(String((respondido.corpo as { correlacaoId: string }).correlacaoId), /^[0-9a-f-]{36}$/);
  });

  it('mapeia erros do Prisma: P2025 → 404, P2002 → 409, P2023 → 400', () => {
    const casos: Array<[string, number]> = [['P2025', 404], ['P2002', 409], ['P2023', 400]];
    for (const [code, status] of casos) {
      const { host, respondido } = anfitriao();
      const erro = Object.assign(new Error('prisma'), { name: 'PrismaClientKnownRequestError', code });
      new FiltroErros().catch(erro, host);
      assert.equal(respondido.status, status, code);
    }
  });
});
