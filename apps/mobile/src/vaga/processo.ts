export interface EtapaProcesso {
  id: string;
  ordem: number;
  tipo: string;
  numeroPerguntas: number;
  perguntas: Array<{ id: string; enunciado: string; tempoLimiteEfetivoSegundos: number }>;
  sugestoes: Array<{ id: string; enunciado: string }>;
}

export interface SituacaoEtapa {
  aprovadas: number;
  pendentes: number;
  numeroPerguntas: number;
  completa: boolean;
}

/** Mesma regra da API para publicar: todas as perguntas aprovadas e nenhuma sugestão pendente. */
export function situacaoEtapa(etapa: Pick<EtapaProcesso, 'numeroPerguntas' | 'perguntas' | 'sugestoes'>): SituacaoEtapa {
  const aprovadas = etapa.perguntas.length;
  const pendentes = etapa.sugestoes.length;
  return {
    aprovadas,
    pendentes,
    numeroPerguntas: etapa.numeroPerguntas,
    completa: pendentes === 0 && aprovadas === etapa.numeroPerguntas,
  };
}

/** Etapas que exigem perguntas (a revisão humana tem 0), na ordem do processo. */
export function etapasComPerguntas<T extends Pick<EtapaProcesso, 'numeroPerguntas' | 'ordem'>>(etapas: T[]): T[] {
  return etapas.filter((etapa) => etapa.numeroPerguntas > 0).sort((a, b) => a.ordem - b.ordem);
}

/** Etapas que ainda impedem a publicação (lista vazia = pode publicar). */
export function etapasIncompletas<T extends EtapaProcesso>(etapas: T[]): T[] {
  return etapasComPerguntas(etapas).filter((etapa) => !situacaoEtapa(etapa).completa);
}

export function processoPronto(etapas: EtapaProcesso[] | null | undefined): boolean {
  if (!etapas || etapas.length === 0) return false;
  return etapasIncompletas(etapas).length === 0;
}
