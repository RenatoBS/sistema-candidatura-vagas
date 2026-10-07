import { randomUUID } from 'node:crypto';

import { criarPrisma } from '../ajuda';
import { api, conta, criarVagaComProcesso, empresaVerificada, type Json } from './ajuda-pg';

/** CNPJs com dígitos verificadores válidos. */
export const CNPJ_EMPRESA_A = '11222333000181';
export const CNPJ_EMPRESA_B = '11444777000161';

export interface EmpresaDeTeste {
  empresaId: string;
  token: string;
  email: string;
  vagaId: string;
  etapaId: string;
  perguntaId: string;
  membroId: string;
  candidaturaId: string;
  entrevistaId: string;
  respostaId: string;
  candidatoId: string;
  curriculoId: string;
  notificacaoId: string;
}

export interface Cenario {
  a: EmpresaDeTeste;
  b: EmpresaDeTeste;
  candidatoToken: string;
}

async function montarEmpresa(sufixo: string, cnpj: string, nome: string): Promise<EmpresaDeTeste> {
  const email = `dono-${sufixo}@pessoal.test`;
  const empresa = await empresaVerificada(await conta(email), cnpj, nome);
  const { vagaId, etapas } = await criarVagaComProcesso(empresa.empresaId, empresa.token, [{ tipo: 'ENTREVISTA_VOZ', numeroPerguntas: 2 }]);
  const etapaId = String(etapas[0]?.id);
  const pergunta = await api(
    `/empresas/${empresa.empresaId}/vagas/${vagaId}/etapas/${etapaId}/perguntas`,
    { method: 'POST', body: JSON.stringify({ enunciado: `Conte um projeto da ${nome}.` }) },
    empresa.token,
  );
  if (pergunta.status !== 201) throw new Error(`pergunta: ${JSON.stringify(pergunta.json)}`);

  // Dados que só existem pelo fluxo de candidato/WhatsApp/voz: semeados com o papel de administração do banco.
  const admin = criarPrisma();
  try {
    const perguntaDb = await admin.etapaPergunta.findFirstOrThrow({ where: { etapaId } });
    const membro = await admin.membroEmpresa.findFirstOrThrow({ where: { empresaId: empresa.empresaId } });
    const usuario = await admin.usuario.create({ data: { email: `cand-${sufixo}@pessoal.test`, senhaHash: 'hash-de-teste' } });
    const candidato = await admin.candidato.create({ data: { usuarioId: usuario.id, nome: 'Pessoa Fixture' } });
    const candidatura = await admin.candidatura.create({
      data: { empresaId: empresa.empresaId, vagaId, candidatoId: candidato.id, origem: 'DIRETA', status: 'TRIAGEM_CONCLUIDA' },
    });
    const entrevista = await admin.entrevista.create({
      data: { empresaId: empresa.empresaId, candidaturaId: candidatura.id, etapaId, canal: 'VOZ_TEMPO_REAL', status: 'CONCLUIDA' },
    });
    const resposta = await admin.resposta.create({
      data: { empresaId: empresa.empresaId, entrevistaId: entrevista.id, etapaPerguntaId: perguntaDb.id, tipo: 'AUDIO_WHATSAPP', transcricao: `segredo da ${nome}`, audioUrl: `respostas/${randomUUID()}.ogg` },
    });
    await admin.score.create({ data: { candidaturaId: candidatura.id, scoreFinal: 70, completude: 0.5 } });
    await admin.avaliacao.create({ data: { respostaId: resposta.id, avaliador: 'IA', nota: 8, justificativa: `justificativa da ${nome}` } });
    // Uma linha em cada tabela restante com empresaId, para o teste de RLS ser significativo em todas.
    const dono = await admin.usuario.findUniqueOrThrow({ where: { email } });
    const instancia = await admin.instanciaWhatsapp.create({
      data: { empresaId: empresa.empresaId, instanciaIdProvedorCifrado: 'x', tokenCifrado: 'y', numero: `5511${sufixo === 'a' ? '1' : '2'}00000000` },
    });
    await admin.eventoWhatsappEntrada.create({
      data: { empresaId: empresa.empresaId, instanciaWhatsappId: instancia.id, mensagemIdProvedor: `m-${sufixo}`, tipo: 'TEXTO', payloadNormalizado: { texto: `mensagem da ${nome}` } },
    });
    await admin.quedaInstanciaWhatsapp.create({ data: { empresaId: empresa.empresaId, instanciaWhatsappId: instancia.id, inicioEm: new Date() } });
    await admin.conviteMembro.create({
      data: { empresaId: empresa.empresaId, email: `convidado-${sufixo}@pessoal.test`, papeis: ['RECRUTADOR'], tokenHash: `hash-convite-${sufixo}`, convidadoPorId: dono.id, expiraEm: new Date(Date.now() + 86_400_000) },
    });
    await admin.eventoVaga.create({ data: { empresaId: empresa.empresaId, vagaId, tipo: 'VagaPausada' } });
    await admin.notificacao.create({ data: { usuarioId: dono.id, empresaId: empresa.empresaId, tipo: 'OPERACIONAL', chaveDedup: `dedup-${sufixo}` } });
    await admin.preferenciaNotificacao.create({ data: { usuarioId: dono.id, empresaId: empresa.empresaId, tipo: 'MATCH_FORTE' } });
    await admin.auditoriaAcesso.create({ data: { usuarioId: dono.id, empresaId: empresa.empresaId, papel: 'ADMIN_EMPRESA', acao: 'TESTE', recursoTipo: 'VAGA' } });
    const curriculo = await admin.curriculo.create({ data: { candidatoId: candidato.id, arquivoKey: `curriculos/${randomUUID()}.pdf` } });
    const notificacao = await admin.notificacao.findFirstOrThrow({ where: { chaveDedup: `dedup-${sufixo}` } });
    return {
      curriculoId: curriculo.id,
      notificacaoId: notificacao.id,
      empresaId: empresa.empresaId,
      token: empresa.token,
      email,
      vagaId,
      etapaId,
      perguntaId: perguntaDb.perguntaId,
      membroId: membro.id,
      candidaturaId: candidatura.id,
      entrevistaId: entrevista.id,
      respostaId: resposta.id,
      candidatoId: candidato.id,
    };
  } finally {
    await admin.$disconnect();
  }
}

export async function montarCenario(): Promise<Cenario> {
  const a = await montarEmpresa('a', CNPJ_EMPRESA_A, 'Acme');
  const b = await montarEmpresa('b', CNPJ_EMPRESA_B, 'Beta');
  const candidatoAcesso = await conta('candidato-http@pessoal.test');
  const onboard = await api('/onboarding/candidato', { method: 'POST', body: JSON.stringify({ nome: 'Pessoa HTTP' }) }, candidatoAcesso);
  const candidatoToken = String((onboard.json as Json).accessToken);
  return { a, b, candidatoToken };
}
