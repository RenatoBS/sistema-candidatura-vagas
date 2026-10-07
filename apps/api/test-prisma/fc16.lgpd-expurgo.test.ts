import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { RepositorioPrisma } from '../src/repositorio/prisma';
import { criarEmpresaEUsuario, criarPrisma, criarVaga, resetarBanco } from './ajuda';

const prisma = criarPrisma();
const NUMERO = '5511999990001';

describe('FC-16 — expurgo LGPD no Postgres', () => {
  before(() => resetarBanco());
  after(() => prisma.$disconnect());

  it('apaga transcrições, áudios, gravações, embedding, eventos, notificações e push; guarda as chaves e o relatório', async () => {
    const { empresa, usuario: usuarioEmpresa } = await criarEmpresaEUsuario(prisma);
    const vaga = await criarVaga(prisma, empresa.id);
    const processo = await prisma.processoSeletivo.create({ data: { vagaId: vaga.id, empresaId: empresa.id } });
    const etapa = await prisma.etapa.create({ data: { processoId: processo.id, ordem: 1, tipo: 'ENTREVISTA_VOZ', numeroPerguntas: 1 } });
    const pergunta = await prisma.pergunta.create({ data: { empresaId: empresa.id, enunciado: 'Conte um projeto.' } });
    const etapaPergunta = await prisma.etapaPergunta.create({ data: { etapaId: etapa.id, perguntaId: pergunta.id, ordem: 1 } });

    const usuario = await prisma.usuario.create({ data: { email: 'candidato16@fixture.test', senhaHash: 'hash-de-teste' } });
    const candidato = await prisma.candidato.create({ data: { usuarioId: usuario.id, nome: 'Pessoa Fixture', whatsapp: NUMERO } });
    await prisma.$executeRaw`UPDATE "candidatos" SET "embedding" = ${`[${Array.from({ length: 1536 }, () => 0.01).join(',')}]`}::vector WHERE "id" = CAST(${candidato.id} AS uuid)`;
    const candidatura = await prisma.candidatura.create({ data: { empresaId: empresa.id, vagaId: vaga.id, candidatoId: candidato.id, origem: 'DIRETA' } });
    const entrevista = await prisma.entrevista.create({
      data: { empresaId: empresa.id, candidaturaId: candidatura.id, etapaId: etapa.id, canal: 'VOZ_TEMPO_REAL', status: 'CONCLUIDA' },
    });
    const resposta = await prisma.resposta.create({
      data: { empresaId: empresa.id, entrevistaId: entrevista.id, etapaPerguntaId: etapaPergunta.id, tipo: 'AUDIO_WHATSAPP', textoOriginal: 'texto', audioUrl: 'respostas/a1.ogg', transcricao: 'transcrição' },
    });
    await prisma.avaliacao.create({ data: { respostaId: resposta.id, avaliador: 'IA', nota: 8, justificativa: 'cita o candidato' } });
    await prisma.sessaoVoz.create({ data: { entrevistaId: entrevista.id, salaId: 'sala', gravacaoKey: 'gravacoes/g1.webm' } });
    await prisma.curriculo.create({ data: { candidatoId: candidato.id, arquivoKey: 'curriculos/cv1.pdf' } });
    const instancia = await prisma.instanciaWhatsapp.create({ data: { empresaId: empresa.id, instanciaIdProvedorCifrado: 'x', tokenCifrado: 'y' } });
    await prisma.eventoWhatsappEntrada.create({
      data: { empresaId: empresa.id, instanciaWhatsappId: instancia.id, mensagemIdProvedor: 'm1', tipo: 'TEXTO', payloadNormalizado: { numeroRemetente: NUMERO, texto: 'oi' } },
    });
    const outroEvento = await prisma.eventoWhatsappEntrada.create({
      data: { empresaId: empresa.id, instanciaWhatsappId: instancia.id, mensagemIdProvedor: 'm2', tipo: 'TEXTO', payloadNormalizado: { numeroRemetente: '5511888880002', texto: 'de outra pessoa' } },
    });
    await prisma.sugestaoMatch.create({ data: { vagaId: vaga.id, candidatoId: candidato.id, compatibilidade: 0.9 } });
    await prisma.notificacao.create({ data: { usuarioId: usuario.id, tipo: 'MATCH_FORTE', chaveDedup: 'dedup-cand-16' } });
    await prisma.dispositivoPush.create({ data: { usuarioId: usuario.id, token: 'tok-16', plataforma: 'ANDROID' } });
    const solicitacao = await prisma.solicitacaoLgpd.create({ data: { usuarioId: usuario.id, candidatoId: candidato.id, tipo: 'EXCLUSAO', status: 'PENDENTE' } });

    const repo = new RepositorioPrisma(prisma);
    const relatorio = await repo.expurgarDadosCandidato(usuario.id, { email: 'excluido@anon.test', senhaHash: 'expurgado', nome: 'Titular excluído' }, solicitacao.id);

    const respostaDepois = await prisma.resposta.findUniqueOrThrow({ where: { id: resposta.id } });
    assert.equal(respostaDepois.transcricao, null);
    assert.equal(respostaDepois.textoOriginal, null);
    assert.equal(respostaDepois.audioUrl, null);
    assert.equal((await prisma.avaliacao.findFirstOrThrow({ where: { respostaId: resposta.id } })).justificativa, null);
    assert.equal((await prisma.sessaoVoz.findFirstOrThrow({ where: { entrevistaId: entrevista.id } })).gravacaoKey, null);
    const [{ tem }] = await prisma.$queryRaw<[{ tem: boolean }]>`SELECT ("embedding" IS NOT NULL) AS tem FROM "candidatos" WHERE "id" = CAST(${candidato.id} AS uuid)`;
    assert.equal(tem, false);
    assert.equal(await prisma.curriculo.count({ where: { candidatoId: candidato.id } }), 0);
    assert.equal(await prisma.sugestaoMatch.count({ where: { candidatoId: candidato.id } }), 0);
    assert.equal(await prisma.notificacao.count({ where: { usuarioId: usuario.id } }), 0);
    assert.equal(await prisma.dispositivoPush.count({ where: { usuarioId: usuario.id } }), 0);
    const eventos = await prisma.eventoWhatsappEntrada.findMany({ orderBy: { mensagemIdProvedor: 'asc' } });
    assert.deepEqual(eventos[0]?.payloadNormalizado, {});
    assert.equal(eventos.find((item) => item.id === outroEvento.id)?.payloadNormalizado !== null && (eventos.find((item) => item.id === outroEvento.id)?.payloadNormalizado as { texto?: string }).texto, 'de outra pessoa');
    const candidatoDepois = await prisma.candidato.findUniqueOrThrow({ where: { id: candidato.id } });
    assert.equal(candidatoDepois.whatsapp, null);
    assert.equal(candidatoDepois.nome, 'Titular excluído');
    assert.equal((await prisma.usuario.findUniqueOrThrow({ where: { id: usuario.id } })).email, 'excluido@anon.test');

    const registro = await prisma.solicitacaoLgpd.findUniqueOrThrow({ where: { id: solicitacao.id } });
    assert.equal(registro.status, 'PENDENTE');
    assert.deepEqual([...(registro.arquivosPendentes as string[])].sort(), ['curriculos/cv1.pdf', 'gravacoes/g1.webm', 'respostas/a1.ogg']);
    assert.equal(relatorio.arquivosParaApagar, 3);
    assert.equal(relatorio.respostasLimpas, 1);
    assert.equal(relatorio.embeddingsRemovidos, 1);
    assert.equal(relatorio.dispositivosRemovidos, 1);
    assert.equal(JSON.stringify(registro.relatorio).includes('fixture'), false);
    // Dados da empresa (outro usuário) intactos.
    assert.ok(await prisma.usuario.findUnique({ where: { id: usuarioEmpresa.id } }));
  });
});
