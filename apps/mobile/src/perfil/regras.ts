export type EstadoRevisao = 'processando' | 'falha' | 'baixa_confianca' | 'revisar' | 'aplicado';

export function estadoRevisao(entrada: {
  status: string;
  baixaConfianca: boolean;
  aplicadoAoPerfil: boolean;
}): EstadoRevisao {
  if (entrada.status === 'FALHA') return 'falha';
  if (entrada.status !== 'CONCLUIDO') return 'processando';
  if (entrada.baixaConfianca) return 'baixa_confianca';
  if (!entrada.aplicadoAoPerfil) return 'revisar';
  return 'aplicado';
}

export const TIPOS_PRIVACIDADE = [
  'TERMOS',
  'WHATSAPP',
  'AUDIO_WHATSAPP',
  'GRAVACAO_VOZ',
  'AVALIACAO_IA',
  'VISIBILIDADE_MATCH',
] as const;

export function habilidadesMarcadas(
  selecionadas: { habilidadeId: string }[],
  id: string,
): boolean {
  return selecionadas.some((item) => item.habilidadeId === id);
}
