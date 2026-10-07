import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import type { AuditoriaService } from '../src/auditoria/auditoria.service';
import { RankingService } from '../src/ranking/ranking.service';
import { RepositorioPrisma } from '../src/repositorio/prisma';
import { montarAtor, type SessaoRequest } from '../src/sessao';
import { criarCandidaturaComScore, criarEmpresaEUsuario, criarPrisma, criarVaga, resetarBanco } from './ajuda';

const prisma = criarPrisma();

function sessaoAdmin(usuarioId: string): SessaoRequest {
  const base = {
    usuario: { id: usuarioId, email: 'admin@fixture.test', senhaHash: '', papeisGlobais: ['ADMIN_PLATAFORMA' as const], mfaAtivo: true, mfaSecretCifrado: null, visaoPreferida: 'ADMIN' as const, emailConfirmadoEm: new Date() },
    mfaVerificado: true,
    visao: 'ADMIN' as const,
    empresaId: null,
    ehCandidato: false,
    membro: null,
    empresa: null,
  };
  return { ...base, ator: montarAtor(base) };
}

describe('FC-12 — GET ranking/vies no Postgres', () => {
  before(() => resetarBanco());
  after(() => prisma.$disconnect());

  function servico() {
    const auditoria = { registrar: async () => undefined } as unknown as AuditoriaService;
    return new RankingService(new RepositorioPrisma(prisma), { agora: () => new Date() }, auditoria);
  }

  it('vaga sem candidaturas responde com distribuição zerada', async () => {
    const { empresa, usuario } = await criarEmpresaEUsuario(prisma);
    const vaga = await criarVaga(prisma, empresa.id);
    const resposta = await servico().vies(sessaoAdmin(usuario.id), empresa.id, vaga.id);
    assert.deepEqual(resposta.distribuicao.map((faixa) => faixa.quantidade), [0, 0, 0, 0]);
    assert.deepEqual(resposta.concordancia, { pares: 0, proximos: 0 });
  });

  it('candidatura com score e sem entrevista não derruba a consulta (UUID vazio)', async () => {
    const { empresa, usuario } = await criarEmpresaEUsuario(prisma);
    const vaga = await criarVaga(prisma, empresa.id);
    await criarCandidaturaComScore(prisma, empresa.id, vaga.id);
    const resposta = await servico().vies(sessaoAdmin(usuario.id), empresa.id, vaga.id);
    assert.deepEqual(resposta.distribuicao.map((faixa) => faixa.quantidade), [0, 0, 1, 0]);
    assert.equal(resposta.expiracoes.comExpiracao, 0);
  });
});
