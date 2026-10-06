import { z } from 'zod';

export const emailSchema = z.string().trim().email().max(180);
export const senhaSchema = z.string().min(8).max(128);

export const cadastroAuthSchema = z.object({
  email: emailSchema,
  senha: senhaSchema,
});

export const loginSchema = cadastroAuthSchema;

export const refreshSchema = z.object({
  refreshToken: z.string().min(20),
});

export const recuperarSenhaSchema = z.object({
  email: emailSchema,
});

export const redefinirSenhaSchema = z.object({
  token: z.string().min(6),
  senha: senhaSchema,
});

export const confirmarEmailSchema = z.object({
  token: z.string().min(6),
});

export const visaoSchema = z.enum(['CANDIDATO', 'EMPRESA', 'ADMIN']);

export const alterarVisaoSchema = z.object({
  visao: visaoSchema,
  empresaId: z.string().uuid().optional(),
});

export const onboardingCandidatoSchema = z.object({
  nome: z.string().trim().min(2).max(160),
});

export const mfaCodigoSchema = z.object({
  codigo: z.string().trim().min(6).max(32),
});

export const reautenticarSchema = z
  .object({
    senha: senhaSchema.optional(),
    codigo: z.string().trim().min(6).max(32).optional(),
  })
  .refine((valor) => Boolean(valor.senha || valor.codigo), {
    message: 'informe senha ou código',
  });
