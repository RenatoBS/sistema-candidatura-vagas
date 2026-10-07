import { z } from 'zod';

/** Rotas da central de notificações e preferências (F6-06). */

export const TIPOS_NOTIFICACAO_EMPRESA = ['CANDIDATO_NOVO', 'MATCH_FORTE'] as const;

export const preferenciasNotificacaoSchema = z.object({
  itens: z
    .array(
      z
        .object({
          tipo: z.enum(TIPOS_NOTIFICACAO_EMPRESA),
          inApp: z.boolean().optional(),
          push: z.boolean().optional(),
          email: z.boolean().optional(),
          limiarMatch: z.number().nullable().optional(),
        })
        .strict(),
    )
    .min(1)
    .max(TIPOS_NOTIFICACAO_EMPRESA.length),
});

export interface NotificacaoDto {
  id: string;
  tipo: (typeof TIPOS_NOTIFICACAO_EMPRESA)[number];
  empresaId: string | null;
  /** `vagaId`, `vagaTitulo` e, fora de resumo, `candidaturaId`/`candidatoId`/`sugestaoId`. */
  dados: Record<string, unknown>;
  agrupadas: number;
  resumo: boolean;
  lida: boolean;
  lidaEm: string | null;
  criadoEm: string;
}

export interface NotificacoesResponse {
  itens: NotificacaoDto[];
  pagina: number;
  limite: number;
  total: number;
  naoLidas: number;
}
