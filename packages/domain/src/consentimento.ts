export const TIPOS_CONSENTIMENTO = [
  'TERMOS',
  'WHATSAPP',
  'AUDIO_WHATSAPP',
  'GRAVACAO_VOZ',
  'AVALIACAO_IA',
  'VISIBILIDADE_MATCH',
] as const;

export type TipoConsentimento = (typeof TIPOS_CONSENTIMENTO)[number];

export const VERSAO_TERMOS_ATUAL = '2026-10-06';

export function tipoConsentimentoValido(valor: string): valor is TipoConsentimento {
  return TIPOS_CONSENTIMENTO.includes(valor as TipoConsentimento);
}

export interface RegistroConsentimento {
  tipo: TipoConsentimento;
  concedido: boolean;
  versaoTermo: string;
  criadoEm: Date;
}

export function consentimentosVigentes<T extends RegistroConsentimento>(registros: T[]): T[] {
  const porTipo = new Map<TipoConsentimento, T>();
  const ordenados = [...registros].sort((a, b) => a.criadoEm.getTime() - b.criadoEm.getTime());
  for (const registro of ordenados) porTipo.set(registro.tipo, registro);
  return [...porTipo.values()];
}
