import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  type Acao,
  type Ator,
  ACOES,
  bypassAdmin,
  decidirPermissao,
  papeisConviteValidos,
} from './permissoes';

const empresa = 'empresa-1';

function ator(parcial: Partial<Ator> & Pick<Ator, 'visao'>): Ator {
  return {
    autenticado: true,
    papeisGlobais: [],
    mfaAtivo: false,
    mfaVerificado: false,
    ehCandidato: false,
    membro: null,
    ...parcial,
  };
}

const admin = ator({
  visao: 'ADMIN',
  papeisGlobais: ['ADMIN_PLATAFORMA'],
  mfaAtivo: true,
  mfaVerificado: true,
});

const adminSemMfa = ator({
  visao: 'ADMIN',
  papeisGlobais: ['ADMIN_PLATAFORMA'],
  mfaAtivo: false,
  mfaVerificado: false,
});

const adminMfaPendente = ator({
  visao: 'ADMIN',
  papeisGlobais: ['ADMIN_PLATAFORMA'],
  mfaAtivo: true,
  mfaVerificado: false,
});

const adminEmpresa = ator({
  visao: 'EMPRESA',
  membro: {
    empresaId: empresa,
    papeis: ['ADMIN_EMPRESA'],
    status: 'ATIVO',
    statusEmpresa: 'VERIFICADA',
  },
});

const adminEmpresaPendente = ator({
  visao: 'EMPRESA',
  membro: {
    empresaId: empresa,
    papeis: ['ADMIN_EMPRESA'],
    status: 'ATIVO',
    statusEmpresa: 'PENDENTE',
  },
});

const recrutador = ator({
  visao: 'EMPRESA',
  membro: {
    empresaId: empresa,
    papeis: ['RECRUTADOR'],
    status: 'ATIVO',
    statusEmpresa: 'VERIFICADA',
  },
});

const avaliador = ator({
  visao: 'EMPRESA',
  membro: {
    empresaId: empresa,
    papeis: ['AVALIADOR'],
    status: 'ATIVO',
    statusEmpresa: 'VERIFICADA',
  },
});

const candidato = ator({
  visao: 'CANDIDATO',
  ehCandidato: true,
});

const ambosNaVisaoCandidato = ator({
  visao: 'CANDIDATO',
  ehCandidato: true,
  membro: {
    empresaId: empresa,
    papeis: ['ADMIN_EMPRESA'],
    status: 'ATIVO',
    statusEmpresa: 'VERIFICADA',
  },
});

function permitido(sujeito: Ator, acao: Acao, empresaId = empresa): boolean {
  return decidirPermissao(sujeito, acao, { empresaId }).permitido;
}

describe('matriz de permissões', () => {
  it('cobre todas as ações declaradas', () => {
    assert.equal(ACOES.length, 17);
  });

  it('admin com MFA bypassa o isolamento; sem MFA ou sem desafio, não', () => {
    assert.equal(bypassAdmin(admin), true);
    assert.equal(bypassAdmin(adminSemMfa), false);
    assert.equal(bypassAdmin(adminMfaPendente), false);
    assert.equal(bypassAdmin(adminEmpresa), false);
  });

  it('admin sem MFA não aprova empresa, não vê áudio e não publica como admin', () => {
    for (const sujeito of [adminSemMfa, adminMfaPendente]) {
      assert.equal(permitido(sujeito, 'aprovar_verificacao_empresa'), false);
      assert.equal(decidirPermissao(sujeito, 'aprovar_verificacao_empresa').motivo, 'MFA_OBRIGATORIO');
      assert.equal(permitido(sujeito, 'ver_audio_transcricao'), false);
      assert.equal(permitido(sujeito, 'publicar_vaga'), false);
      assert.equal(permitido(sujeito, 'consultar_auditoria'), false);
    }
  });

  it('admin com MFA acessa moderação, score, áudio auditado e WhatsApp', () => {
    assert.equal(permitido(admin, 'aprovar_verificacao_empresa'), true);
    assert.equal(decidirPermissao(admin, 'aprovar_verificacao_empresa').auditar, true);
    assert.equal(permitido(admin, 'gerenciar_membros'), true);
    assert.equal(permitido(admin, 'criar_vaga'), true);
    assert.equal(permitido(admin, 'publicar_vaga'), true);
    assert.equal(permitido(admin, 'pausar_vaga'), true);
    assert.equal(permitido(admin, 'ver_score'), true);
    assert.equal(decidirPermissao(admin, 'ver_audio_transcricao').auditar, true);
    assert.equal(permitido(admin, 'revisao_humana'), true);
    assert.equal(permitido(admin, 'configurar_tenant'), true);
    assert.equal(permitido(admin, 'conectar_whatsapp'), true);
    assert.equal(permitido(admin, 'ver_status_whatsapp'), true);
    assert.equal(permitido(admin, 'consultar_auditoria'), true);
    assert.equal(permitido(admin, 'editar_proprio_perfil'), false);
    assert.equal(permitido(admin, 'candidatar'), false);
  });

  it('admin da empresa gerencia membros e WhatsApp; publica só se VERIFICADA', () => {
    assert.equal(permitido(adminEmpresa, 'gerenciar_membros'), true);
    assert.equal(permitido(adminEmpresa, 'criar_vaga'), true);
    assert.equal(permitido(adminEmpresa, 'publicar_vaga'), true);
    assert.equal(permitido(adminEmpresa, 'conectar_whatsapp'), true);
    assert.equal(permitido(adminEmpresa, 'ver_score'), true);
    assert.equal(decidirPermissao(adminEmpresa, 'ver_audio_transcricao', { empresaId: empresa }).auditar, true);
    assert.equal(permitido(adminEmpresa, 'consultar_auditoria'), true);
    assert.equal(permitido(adminEmpresa, 'aprovar_verificacao_empresa'), false);
    assert.equal(permitido(adminEmpresaPendente, 'publicar_vaga'), false);
    assert.equal(
      decidirPermissao(adminEmpresaPendente, 'publicar_vaga', { empresaId: empresa }).motivo,
      'EMPRESA_NAO_VERIFICADA',
    );
    assert.equal(permitido(adminEmpresaPendente, 'criar_vaga'), true);
  });

  it('recrutador cria e pausa vaga, mas não gerencia membros nem WhatsApp', () => {
    assert.equal(permitido(recrutador, 'criar_vaga'), true);
    assert.equal(permitido(recrutador, 'publicar_vaga'), true);
    assert.equal(permitido(recrutador, 'pausar_vaga'), true);
    assert.equal(permitido(recrutador, 'revisao_humana'), true);
    assert.equal(permitido(recrutador, 'gerenciar_membros'), false);
    assert.equal(permitido(recrutador, 'conectar_whatsapp'), false);
    assert.equal(permitido(recrutador, 'configurar_tenant'), false);
  });

  it('avaliador revisa e vê áudio da própria empresa, sem criar vaga', () => {
    assert.equal(permitido(avaliador, 'revisao_humana'), true);
    assert.equal(permitido(avaliador, 'ver_audio_transcricao'), true);
    assert.equal(permitido(avaliador, 'ver_score'), true);
    assert.equal(permitido(avaliador, 'ver_status_whatsapp'), true);
    assert.equal(permitido(avaliador, 'criar_vaga'), false);
    assert.equal(permitido(avaliador, 'publicar_vaga'), false);
    assert.equal(permitido(avaliador, 'gerenciar_membros'), false);
  });

  it('candidato edita o próprio perfil e nunca vê score, áudio de terceiros ou rotas da empresa', () => {
    assert.equal(permitido(candidato, 'editar_proprio_perfil'), true);
    assert.equal(permitido(candidato, 'candidatar'), true);
    assert.equal(permitido(candidato, 'ver_status_propria_candidatura'), true);
    assert.equal(permitido(candidato, 'ver_vagas_publicas'), true);
    assert.equal(permitido(candidato, 'ver_score'), false);
    assert.equal(decidirPermissao(candidato, 'ver_score').motivo, 'SCORE_INVISIVEL_CANDIDATO');
    assert.equal(permitido(candidato, 'ver_audio_transcricao'), false);
    assert.equal(permitido(candidato, 'gerenciar_membros'), false);
    assert.equal(permitido(candidato, 'criar_vaga'), false);
    assert.equal(permitido(candidato, 'publicar_vaga'), false);
    assert.equal(permitido(candidato, 'aprovar_verificacao_empresa'), false);
    assert.equal(permitido(candidato, 'consultar_auditoria'), false);
  });

  it('quem tem os dois papéis não vê score na visão candidato e vê na visão empresa', () => {
    assert.equal(permitido(ambosNaVisaoCandidato, 'ver_score'), false);
    assert.equal(permitido(ambosNaVisaoCandidato, 'gerenciar_membros'), false);
    const naEmpresa = { ...ambosNaVisaoCandidato, visao: 'EMPRESA' as const };
    assert.equal(permitido(naEmpresa, 'ver_score'), true);
    assert.equal(permitido(naEmpresa, 'gerenciar_membros'), true);
    assert.equal(permitido(naEmpresa, 'candidatar'), false);
  });

  it('membro não acessa outra empresa', () => {
    assert.equal(permitido(adminEmpresa, 'gerenciar_membros', 'empresa-2'), false);
    assert.equal(permitido(recrutador, 'criar_vaga', 'empresa-2'), false);
  });

  it('convite só concede recrutador ou avaliador', () => {
    assert.equal(papeisConviteValidos(['RECRUTADOR']), true);
    assert.equal(papeisConviteValidos(['AVALIADOR']), true);
    assert.equal(papeisConviteValidos(['ADMIN_EMPRESA']), false);
    assert.equal(papeisConviteValidos([]), false);
  });
});
