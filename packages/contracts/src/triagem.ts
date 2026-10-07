import { z } from 'zod';

/** Saída da avaliação de triagem. Validada antes de persistir a nota da IA. */
export const saidaAvaliacaoIaSchema = z.object({
  nota: z.number().min(0).max(10),
  criterios: z.record(z.unknown()),
  justificativa: z.string().min(1),
  confianca: z.number().min(0).max(1),
});

export const revisaoTriagemSchema = z.object({
  nota: z.number().min(0).max(10),
  justificativa: z.string().min(1),
});

export type SaidaAvaliacaoIaContrato = z.infer<typeof saidaAvaliacaoIaSchema>;
export type RevisaoTriagemInput = z.infer<typeof revisaoTriagemSchema>;
