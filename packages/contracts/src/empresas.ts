import { z } from 'zod';

import { emailSchema } from './auth';

export const cadastroEmpresaSchema = z.object({
  razaoSocial: z.string().trim().min(2).max(200),
  nomeFantasia: z.string().trim().min(2).max(200),
  cnpj: z.string().trim().min(14).max(18),
  dominio: z.string().trim().min(3).max(180),
  responsavelNome: z.string().trim().min(2).max(160),
  responsavelEmail: emailSchema,
  responsavelCargo: z.string().trim().max(80).optional(),
  telefone: z.string().trim().max(30).optional(),
  endereco: z.record(z.string(), z.unknown()).optional(),
});

export const codigoVerificacaoSchema = z.object({
  codigo: z.string().trim().min(6).max(64),
});

export const motivoSchema = z.object({
  motivo: z.string().trim().min(3).max(500),
});

export const motivoOpcionalSchema = z.object({
  motivo: z.string().trim().min(3).max(500).optional(),
});

export const conviteMembroSchema = z.object({
  email: emailSchema,
  papeis: z.array(z.enum(['RECRUTADOR', 'AVALIADOR'])).min(1),
});

export const aceitarConviteSchema = z.object({
  token: z.string().min(10),
});
