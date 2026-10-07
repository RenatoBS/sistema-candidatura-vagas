import { z } from 'zod';

export const TIPOS_CONSENTIMENTO_API = [
  'TERMOS',
  'WHATSAPP',
  'AUDIO_WHATSAPP',
  'GRAVACAO_VOZ',
  'AVALIACAO_IA',
  'VISIBILIDADE_MATCH',
] as const;

export const linkedinUrlSchema = z.string().trim().max(300).nullable();

export const atualizarPerfilSchema = z.object({
  nome: z.string().trim().min(2).max(160).optional(),
  whatsapp: z.string().trim().max(20).nullable().optional(),
  linkedinUrl: linkedinUrlSchema.optional(),
  visivelParaMatch: z.boolean().optional(),
  perfil: z
    .object({
      resumo: z.string().max(4000).optional(),
      experiencias: z
        .array(
          z.object({
            cargo: z.string().max(160),
            organizacao: z.string().max(160),
            inicio: z.string().max(40).nullable().optional(),
            fim: z.string().max(40).nullable().optional(),
          }),
        )
        .max(30)
        .optional(),
      formacao: z
        .array(
          z.object({
            curso: z.string().max(160),
            instituicao: z.string().max(160),
          }),
        )
        .max(20)
        .optional(),
      idiomas: z.array(z.string().max(40)).max(20).optional(),
    })
    .optional(),
});

export const habilidadesCandidatoSchema = z.object({
  itens: z
    .array(
      z.object({
        habilidadeId: z.string().uuid(),
        nivel: z.number().int().min(1).max(5),
        anosExperiencia: z.number().min(0).max(60).nullable().optional(),
      }),
    )
    .max(50),
});

export const uploadCurriculoSchema = z.object({
  mimeType: z.string().min(3).max(120),
  tamanhoBytes: z.number().int().positive(),
});

export const registrarCurriculoSchema = uploadCurriculoSchema.extend({
  arquivoKey: z.string().min(8).max(300),
});

export const dadosExtraidosSchema = z.object({
  resumo: z.string().max(4000),
  experiencias: z
    .array(
      z.object({
        cargo: z.string().max(160),
        organizacao: z.string().max(160),
        inicio: z.string().max(40).nullable(),
        fim: z.string().max(40).nullable(),
      }),
    )
    .max(30),
  formacao: z
    .array(
      z.object({
        curso: z.string().max(160),
        instituicao: z.string().max(160),
      }),
    )
    .max(20),
  idiomas: z.array(z.string().max(40)).max(20),
  habilidades: z
    .array(
      z.object({
        nome: z.string().max(80),
        nivel: z.number().int().min(1).max(5),
      }),
    )
    .max(50),
});

export const confirmarCurriculoSchema = z.object({
  dados: dadosExtraidosSchema.optional(),
});

export const consentimentoSchema = z.object({
  tipo: z.enum(TIPOS_CONSENTIMENTO_API),
  concedido: z.boolean(),
  versaoTermo: z.string().trim().min(1).max(40),
});

export const candidaturaDiretaSchema = z.object({ consentimentos: z.array(consentimentoSchema).min(1) });
export const conviteAceiteSchema = candidaturaDiretaSchema;

export const excluirDadosSchema = z.object({
  confirmacao: z.literal('EXCLUIR'),
});
