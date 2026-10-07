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

export type SituacaoCurriculo = 'PENDENTE' | 'PROCESSANDO' | 'FALHA' | 'AGUARDANDO' | 'APLICADO';

/** Situação exibida na lista de CVs; AGUARDANDO = lido, mas ainda não confirmado pelo candidato. */
export function situacaoCurriculo(item: { statusProcessamento: string; aplicadoAoPerfil: boolean }): SituacaoCurriculo {
  if (item.statusProcessamento === 'FALHA') return 'FALHA';
  if (item.statusProcessamento === 'PENDENTE') return 'PENDENTE';
  if (item.statusProcessamento !== 'CONCLUIDO') return 'PROCESSANDO';
  return item.aplicadoAoPerfil ? 'APLICADO' : 'AGUARDANDO';
}

export const TIPOS_PRIVACIDADE = [
  'TERMOS',
  'WHATSAPP',
  'AUDIO_WHATSAPP',
  'GRAVACAO_VOZ',
  'AVALIACAO_IA',
  'VISIBILIDADE_MATCH',
] as const;

export type TipoPrivacidade = (typeof TIPOS_PRIVACIDADE)[number];

/** O consentimento VISIBILIDADE_MATCH segue o interruptor "Visível para match"; não tem toggle próprio. */
export const TIPOS_PRIVACIDADE_EXIBIDOS = TIPOS_PRIVACIDADE.filter((tipo) => tipo !== 'VISIBILIDADE_MATCH');

export function consentimentosParaSalvar(
  concedidos: Record<string, boolean>,
  visivelParaMatch: boolean,
): Array<{ tipo: TipoPrivacidade; concedido: boolean }> {
  return TIPOS_PRIVACIDADE.map((tipo) => ({
    tipo,
    concedido: tipo === 'VISIBILIDADE_MATCH' ? visivelParaMatch : Boolean(concedidos[tipo]),
  }));
}

export function habilidadesMarcadas(
  selecionadas: { habilidadeId: string }[],
  id: string,
): boolean {
  return selecionadas.some((item) => item.habilidadeId === id);
}
