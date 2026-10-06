import { z } from 'zod';

export const senioridadeSchema = z.enum(['ESTAGIO', 'JUNIOR', 'PLENO', 'SENIOR', 'ESPECIALISTA', 'LIDERANCA']);
export const modeloTrabalhoSchema = z.enum(['REMOTO', 'HIBRIDO', 'PRESENCIAL']);
export const tipoContratoSchema = z.enum(['CLT', 'PJ', 'TEMPORARIO', 'ESTAGIO', 'AUTONOMO']);
export const tipoEtapaSchema = z.enum(['TRIAGEM_WHATSAPP', 'ENTREVISTA_VOZ', 'REVISAO_HUMANA']);

export const habilidadeVagaSchema = z.object({
  habilidadeId: z.string().uuid().optional(),
  nome: z.string().trim().min(1).max(80).optional(),
  nivelMinimo: z.number().int().min(1).max(5),
  peso: z.number().positive().max(100),
  obrigatoria: z.boolean().optional(),
});

export const criarVagaSchema = z.object({
  titulo: z.string().trim().min(3).max(160),
  descricao: z.string().trim().min(10).max(8000),
  senioridade: senioridadeSchema,
  modelo: modeloTrabalhoSchema,
  localidade: z.string().trim().max(120).nullable().optional(),
  tipoContrato: tipoContratoSchema.nullable().optional(),
  faixaSalarialMin: z.number().nonnegative().nullable().optional(),
  faixaSalarialMax: z.number().nonnegative().nullable().optional(),
  beneficios: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  posicoes: z.number().int().min(1).max(999).optional(),
  prazoInscricoes: z.string().trim().min(16).max(40).nullable().optional(),
  habilidades: z.array(habilidadeVagaSchema).max(30).optional(),
});

export const atualizarVagaSchema = criarVagaSchema.partial();

export const politicaRetrySchema = z
  .object({
    tentativas: z.number().int().min(0).max(10),
    intervaloMinutos: z.number().int().min(1).max(10080),
    prazoTotalHoras: z.number().int().min(1).max(720),
    horarioComercial: z.boolean(),
    prazoInatividadeHoras: z.number().int().min(1).max(720),
  })
  .partial();

export const etapaProcessoSchema = z.object({
  ordem: z.number().int().min(1).max(20),
  tipo: tipoEtapaSchema,
  numeroPerguntas: z.number().int().min(0).max(20).optional(),
});

export const salvarProcessoSchema = z.object({
  tempoPadraoPorPergunta: z.number().int().min(30).max(3600).optional(),
  janelaReconexaoSegundos: z.number().int().min(0).max(600).optional(),
  politicaRetry: politicaRetrySchema.optional(),
  etapas: z.array(etapaProcessoSchema).min(1).max(10),
});

export const criarPerguntaSchema = z.object({
  enunciado: z.string().trim().min(5).max(2000),
  rubrica: z.record(z.string(), z.unknown()).optional(),
  tempoLimiteSegundos: z.number().int().min(15).max(3600).nullable().optional(),
});

export const vincularPerguntaSchema = z
  .object({
    perguntaId: z.string().uuid().optional(),
    enunciado: z.string().trim().min(5).max(2000).optional(),
    rubrica: z.record(z.string(), z.unknown()).optional(),
    tempoLimiteSegundos: z.number().int().min(15).max(3600).nullable().optional(),
    tempoLimiteEtapaSegundos: z.number().int().min(15).max(3600).nullable().optional(),
  })
  .refine((valor) => Boolean(valor.perguntaId || valor.enunciado), { message: 'pergunta' });

export const revisarSugestaoSchema = z.object({
  enunciado: z.string().trim().min(5).max(2000).optional(),
  rubrica: z.record(z.string(), z.unknown()).optional(),
  tempoLimiteSegundos: z.number().int().min(15).max(3600).nullable().optional(),
});

export const prorrogarVagaSchema = z.object({
  prazoInscricoes: z.string().trim().min(16).max(40),
});

export const fecharVagaSchema = z.object({
  motivo: z.string().trim().min(3).max(500),
});

export type CriarVagaInput = z.infer<typeof criarVagaSchema>;
export type AtualizarVagaInput = z.infer<typeof atualizarVagaSchema>;
export type SalvarProcessoInput = z.infer<typeof salvarProcessoSchema>;
export type CriarPerguntaInput = z.infer<typeof criarPerguntaSchema>;
export type VincularPerguntaInput = z.infer<typeof vincularPerguntaSchema>;
