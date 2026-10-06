import {
  ModeloTrabalho,
  PapelEmpresa,
  PapelGlobal,
  PrismaClient,
  SenioridadeVaga,
  StatusVerificacaoEmpresa,
  StatusVaga,
  TipoVerificacaoEmpresa,
  VisaoPreferida,
} from '@prisma/client';

const VAGA_IDS = {
  'verificada-a': 'a0000001-0000-4000-8000-000000000001',
  'verificada-b': 'a0000002-0000-4000-8000-000000000002',
} as const;

const prisma = new PrismaClient();

const HABILIDADES_SEED = [
  { nome: 'TypeScript', categoria: 'linguagem', sinonimos: ['TS'] },
  { nome: 'JavaScript', categoria: 'linguagem', sinonimos: ['JS'] },
  { nome: 'Node.js', categoria: 'plataforma', sinonimos: ['Node'] },
  { nome: 'React', categoria: 'framework', sinonimos: ['ReactJS'] },
  { nome: 'PostgreSQL', categoria: 'banco', sinonimos: ['Postgres'] },
  { nome: 'AWS', categoria: 'cloud', sinonimos: ['Amazon Web Services'] },
  { nome: 'Docker', categoria: 'ferramenta', sinonimos: [] },
  { nome: 'Comunicação', categoria: 'soft_skill', sinonimos: [] },
  { nome: 'Liderança', categoria: 'soft_skill', sinonimos: [] },
  { nome: 'NestJS', categoria: 'framework', sinonimos: [] },
];

async function seedHabilidades() {
  for (const h of HABILIDADES_SEED) {
    await prisma.habilidade.upsert({
      where: { nome: h.nome },
      update: { categoria: h.categoria, sinonimos: h.sinonimos },
      create: h,
    });
  }
}

async function seedEmpresasEUsuarios() {
  const admin = await prisma.usuario.upsert({
    where: { email: 'admin@scv.dev' },
    update: {},
    create: {
      email: 'admin@scv.dev',
      senhaHash: '$argon2id$placeholder_admin',
      papeisGlobais: [PapelGlobal.ADMIN_PLATAFORMA],
      mfaAtivo: true,
      visaoPreferida: VisaoPreferida.ADMIN,
    },
  });

  const adminSemMfa = await prisma.usuario.upsert({
    where: { email: 'admin-sem-mfa@scv.dev' },
    update: {},
    create: {
      email: 'admin-sem-mfa@scv.dev',
      senhaHash: '$argon2id$placeholder_admin_sem_mfa',
      papeisGlobais: [PapelGlobal.ADMIN_PLATAFORMA],
      mfaAtivo: false,
      visaoPreferida: VisaoPreferida.ADMIN,
    },
  });

  const candidatoEmpresa = await prisma.usuario.upsert({
    where: { email: 'dual@scv.dev' },
    update: {},
    create: {
      email: 'dual@scv.dev',
      senhaHash: '$argon2id$placeholder_dual',
      visaoPreferida: VisaoPreferida.CANDIDATO,
    },
  });

  const candidatoPuro = await prisma.usuario.upsert({
    where: { email: 'candidato@scv.dev' },
    update: {},
    create: {
      email: 'candidato@scv.dev',
      senhaHash: '$argon2id$placeholder_candidato',
      visaoPreferida: VisaoPreferida.CANDIDATO,
    },
  });

  const recrutadorA = await prisma.usuario.upsert({
    where: { email: 'recrutador-a@empresa-a.dev' },
    update: {},
    create: {
      email: 'recrutador-a@empresa-a.dev',
      senhaHash: '$argon2id$placeholder_recrutador_a',
      visaoPreferida: VisaoPreferida.EMPRESA,
    },
  });

  const recrutadorB = await prisma.usuario.upsert({
    where: { email: 'recrutador-b@empresa-b.dev' },
    update: {},
    create: {
      email: 'recrutador-b@empresa-b.dev',
      senhaHash: '$argon2id$placeholder_recrutador_b',
      visaoPreferida: VisaoPreferida.EMPRESA,
    },
  });

  const empresasSpec = [
    {
      key: 'pendente',
      razaoSocial: 'Empresa Pendente LTDA',
      nomeFantasia: 'Empresa Pendente',
      cnpj: '11111111000111',
      dominio: 'pendente.dev',
      status: StatusVerificacaoEmpresa.PENDENTE,
      adminEmail: 'admin-pendente@pendente.dev',
    },
    {
      key: 'verificada-a',
      razaoSocial: 'Empresa Alpha Tecnologia LTDA',
      nomeFantasia: 'Empresa Alpha',
      cnpj: '22222222000122',
      dominio: 'alpha.dev',
      status: StatusVerificacaoEmpresa.VERIFICADA,
      adminEmail: 'admin@alpha.dev',
      recrutador: recrutadorA,
    },
    {
      key: 'verificada-b',
      razaoSocial: 'Empresa Beta Soluções LTDA',
      nomeFantasia: 'Empresa Beta',
      cnpj: '33333333000133',
      dominio: 'beta.dev',
      status: StatusVerificacaoEmpresa.VERIFICADA,
      adminEmail: 'admin@beta.dev',
      recrutador: recrutadorB,
    },
    {
      key: 'rejeitada',
      razaoSocial: 'Empresa Rejeitada LTDA',
      nomeFantasia: 'Empresa Rejeitada',
      cnpj: '44444444000144',
      dominio: 'rejeitada.dev',
      status: StatusVerificacaoEmpresa.REJEITADA,
      adminEmail: 'admin@rejeitada.dev',
    },
    {
      key: 'suspensa',
      razaoSocial: 'Empresa Suspensa LTDA',
      nomeFantasia: 'Empresa Suspensa',
      cnpj: '55555555000155',
      dominio: 'suspensa.dev',
      status: StatusVerificacaoEmpresa.SUSPENSA,
      adminEmail: 'admin@suspensa.dev',
    },
  ] as const;

  for (const spec of empresasSpec) {
    const adminEmpresa = await prisma.usuario.upsert({
      where: { email: spec.adminEmail },
      update: {},
      create: {
        email: spec.adminEmail,
        senhaHash: `$argon2id$placeholder_${spec.key}`,
        visaoPreferida: VisaoPreferida.EMPRESA,
      },
    });

    const empresa = await prisma.empresa.upsert({
      where: { cnpj: spec.cnpj },
      update: { statusVerificacao: spec.status },
      create: {
        razaoSocial: spec.razaoSocial,
        nomeFantasia: spec.nomeFantasia,
        cnpj: spec.cnpj,
        dominio: spec.dominio,
        responsavelNome: `Responsável ${spec.nomeFantasia}`,
        responsavelEmail: spec.adminEmail,
        responsavelCargo: 'CEO',
        statusVerificacao: spec.status,
        verificadaEm:
          spec.status === StatusVerificacaoEmpresa.VERIFICADA
            ? new Date('2026-01-15T12:00:00.000Z')
            : null,
      },
    });

    await prisma.membroEmpresa.upsert({
      where: { usuarioId_empresaId: { usuarioId: adminEmpresa.id, empresaId: empresa.id } },
      update: { papeis: [PapelEmpresa.ADMIN_EMPRESA] },
      create: {
        usuarioId: adminEmpresa.id,
        empresaId: empresa.id,
        papeis: [PapelEmpresa.ADMIN_EMPRESA],
      },
    });

    if ('recrutador' in spec && spec.recrutador) {
      await prisma.membroEmpresa.upsert({
        where: {
          usuarioId_empresaId: { usuarioId: spec.recrutador.id, empresaId: empresa.id },
        },
        update: { papeis: [PapelEmpresa.RECRUTADOR] },
        create: {
          usuarioId: spec.recrutador.id,
          empresaId: empresa.id,
          papeis: [PapelEmpresa.RECRUTADOR],
        },
      });
    }

    await prisma.verificacaoEmpresa.createMany({
      data: [
        {
          empresaId: empresa.id,
          tipo: TipoVerificacaoEmpresa.EMAIL,
          resultado: spec.status === StatusVerificacaoEmpresa.REJEITADA ? 'FALHA' : 'OK',
          detalhes: { seed: true },
        },
        {
          empresaId: empresa.id,
          tipo: TipoVerificacaoEmpresa.CNPJ,
          resultado: spec.status === StatusVerificacaoEmpresa.REJEITADA ? 'FALHA' : 'OK',
          detalhes: { seed: true },
        },
      ],
      skipDuplicates: true,
    });

    if (spec.key === 'verificada-a' || spec.key === 'verificada-b') {
      const prazo = new Date('2026-12-31T23:59:59.000Z');
      const vagaId = VAGA_IDS[spec.key];
      const vaga = await prisma.vaga.upsert({
        where: { id: vagaId },
        update: {},
        create: {
          id: vagaId,
          empresaId: empresa.id,
          titulo: `Desenvolvedor Full Stack — ${spec.nomeFantasia}`,
          descricao: 'Vaga de demonstração para seeds da Fase 2.',
          senioridade: SenioridadeVaga.PLENO,
          modelo: ModeloTrabalho.REMOTO,
          status: StatusVaga.PUBLICADA,
          prazoInscricoes: prazo,
          pesosRanking: {
            perfil: 10,
            habilidades: 25,
            curriculo: 10,
            linkedin: 2,
            triagem: 23,
            entrevista: 30,
          },
        },
      });

      await prisma.processoSeletivo.upsert({
        where: { vagaId: vaga.id },
        update: {},
        create: {
          vagaId: vaga.id,
          empresaId: empresa.id,
          tempoPadraoPorPergunta: 180,
          politicaRetry: {
            tentativas: 3,
            intervaloHoras: 24,
            prazoTotalHoras: 96,
            horarioComercial: { inicio: '09:00', fim: '18:00', fuso: 'America/Sao_Paulo' },
          },
        },
      });
    }
  }

  await prisma.candidato.upsert({
    where: { usuarioId: candidatoPuro.id },
    update: {},
    create: {
      usuarioId: candidatoPuro.id,
      nome: 'Candidato Seed',
      whatsapp: '+5511999990001',
    },
  });

  await prisma.candidato.upsert({
    where: { usuarioId: candidatoEmpresa.id },
    update: {},
    create: {
      usuarioId: candidatoEmpresa.id,
      nome: 'Usuário Dual (Candidato + Empresa)',
      whatsapp: '+5511999990002',
      linkedinUrl: 'https://www.linkedin.com/in/candidato-dual',
    },
  });

  const empresaAlpha = await prisma.empresa.findUnique({ where: { cnpj: '22222222000122' } });
  if (empresaAlpha) {
    await prisma.membroEmpresa.upsert({
      where: {
        usuarioId_empresaId: { usuarioId: candidatoEmpresa.id, empresaId: empresaAlpha.id },
      },
      update: { papeis: [PapelEmpresa.AVALIADOR] },
      create: {
        usuarioId: candidatoEmpresa.id,
        empresaId: empresaAlpha.id,
        papeis: [PapelEmpresa.AVALIADOR],
      },
    });
  }

  console.log('Seeds de usuários e empresas aplicados.', {
    adminId: admin.id,
    adminSemMfaId: adminSemMfa.id,
    candidatoDualId: candidatoEmpresa.id,
  });
}

async function main() {
  console.log('Iniciando seeds Fase 2...');
  await seedHabilidades();
  await seedEmpresasEUsuarios();
  console.log('Seeds concluídos com sucesso.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
