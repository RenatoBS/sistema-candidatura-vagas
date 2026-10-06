export type PocModo = 'mock' | 'openai' | 'hibrido';

export interface EtapaLatencia {
  etapa: string;
  inicioMs: number;
  fimMs: number;
  duracaoMs: number;
  detalhe?: string;
}

export interface ResultadoTurno {
  transcricao: string;
  respostaLlm: string;
  audioRespostaBytes?: number;
}

export interface RelatorioLatencia {
  meta: {
    versao: string;
    timestamp: string;
    modo: PocModo;
    pipeline: string;
    fixtureAudio: string;
  };
  orcamento: {
    vadTurnoMs: [number, number];
    sttMs: [number, number];
    llmPrimeiroTokenMs: [number, number];
    ttsPrimeiroAudioMs: [number, number];
    redeMs: [number, number];
    totalPercebidoMs: number;
  };
  etapas: EtapaLatencia[];
  metricas: {
    vadTurnoMs: number;
    sttMs: number;
    llmPrimeiroTokenMs: number;
    llmTotalMs: number;
    ttsPrimeiroAudioMs: number;
    ttsTotalMs: number;
    redeEstimadaMs: number;
    totalPercebidoMs: number;
    e2eMs: number;
  };
  resultado: ResultadoTurno;
}
