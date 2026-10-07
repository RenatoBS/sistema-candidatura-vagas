// Espelham `senioridadeSchema` e `modeloTrabalhoSchema` de @scv/contracts (vagas.ts).
export const SENIORIDADES = ['ESTAGIO', 'JUNIOR', 'PLENO', 'SENIOR', 'ESPECIALISTA', 'LIDERANCA'] as const;
export const MODELOS_TRABALHO = ['REMOTO', 'HIBRIDO', 'PRESENCIAL'] as const;

export type Senioridade = (typeof SENIORIDADES)[number];
export type ModeloTrabalho = (typeof MODELOS_TRABALHO)[number];

export const PESOS_RANKING = ['perfil', 'habilidades', 'curriculo', 'linkedin', 'triagem', 'voz'] as const;

/** Completude chega como fração (0 a 1); exibe em % inteiro. */
export function percentualInteiro(fracao: number | null | undefined): number {
  if (fracao === null || fracao === undefined || !Number.isFinite(fracao)) return 0;
  return Math.round(Math.min(Math.max(fracao, 0), 1) * 100);
}
