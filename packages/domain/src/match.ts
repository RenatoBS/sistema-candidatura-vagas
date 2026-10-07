import { aceitaInscricoes, type EstadoVaga } from './vaga';

/** Dimensão das colunas `vector(1536)` em vagas e candidatos. */
export const DIMENSOES_EMBEDDING = 1536;
export const LIMIAR_MATCH_FORTE_PADRAO = 0.75;
export const VERSAO_MATCH = 'match-v1';

/** Peso da similaridade semântica; o restante vem da cobertura de habilidades. */
const PESO_SEMANTICO = 0.6;

export interface HabilidadeExigidaMatch {
  habilidadeId: string;
  nome: string;
  nivelMinimo: number;
  peso: number;
  obrigatoria: boolean;
}

export interface HabilidadeCandidatoMatch {
  habilidadeId: string;
  nome: string;
  nivel: number;
}

export interface ExplicacaoMatch {
  versao: string;
  similaridade: number;
  coberturaHabilidades: number | null;
  atendidas: string[];
  abaixoDoNivel: string[];
  faltantes: string[];
}

export interface ResultadoMatch {
  compatibilidade: number;
  explicacao: ExplicacaoMatch;
}

/** Só vagas PUBLICADA e dentro do prazo entram no match (nunca pausada, encerrada, fechada ou rascunho). */
export function vagaElegivelParaMatch(vaga: Pick<EstadoVaga, 'status' | 'prazoInscricoes'>, agora: Date): boolean {
  return aceitaInscricoes(vaga, agora);
}

export function similaridadeCosseno(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let produto = 0;
  let normaA = 0;
  let normaB = 0;
  for (let i = 0; i < a.length; i += 1) {
    produto += a[i]! * b[i]!;
    normaA += a[i]! * a[i]!;
    normaB += b[i]! * b[i]!;
  }
  if (normaA === 0 || normaB === 0) return 0;
  return produto / Math.sqrt(normaA * normaB);
}

export function atendeObrigatorias(
  exigidas: readonly HabilidadeExigidaMatch[],
  candidato: readonly HabilidadeCandidatoMatch[],
): boolean {
  const niveis = new Map(candidato.map((item) => [item.habilidadeId, item.nivel]));
  return exigidas.every((item) => !item.obrigatoria || (niveis.get(item.habilidadeId) ?? 0) >= item.nivelMinimo);
}

/**
 * Compatibilidade em [0, 1]: similaridade semântica (cosseno, negativos viram 0)
 * combinada com a cobertura ponderada das habilidades da vaga.
 */
export function calcularCompatibilidade(entrada: {
  similaridade: number;
  exigidas: readonly HabilidadeExigidaMatch[];
  candidato: readonly HabilidadeCandidatoMatch[];
}): ResultadoMatch {
  const similaridade = limitar(entrada.similaridade);
  const niveis = new Map(entrada.candidato.map((item) => [item.habilidadeId, item.nivel]));
  const atendidas: string[] = [];
  const abaixoDoNivel: string[] = [];
  const faltantes: string[] = [];
  let pesoTotal = 0;
  let pesoAtendido = 0;
  for (const item of entrada.exigidas) {
    const peso = Math.max(0, item.peso);
    pesoTotal += peso;
    const nivel = niveis.get(item.habilidadeId);
    if (nivel === undefined) {
      faltantes.push(item.nome);
    } else if (nivel >= item.nivelMinimo) {
      atendidas.push(item.nome);
      pesoAtendido += peso;
    } else {
      abaixoDoNivel.push(item.nome);
      pesoAtendido += item.nivelMinimo > 0 ? peso * (nivel / item.nivelMinimo) : peso;
    }
  }
  const cobertura = pesoTotal > 0 ? pesoAtendido / pesoTotal : null;
  const bruta = cobertura === null ? similaridade : PESO_SEMANTICO * similaridade + (1 - PESO_SEMANTICO) * cobertura;
  return {
    compatibilidade: arredondar(bruta),
    explicacao: {
      versao: VERSAO_MATCH,
      similaridade: arredondar(similaridade),
      coberturaHabilidades: cobertura === null ? null : arredondar(cobertura),
      atendidas,
      abaixoDoNivel,
      faltantes,
    },
  };
}

export function matchForte(compatibilidade: number, limiar: number = LIMIAR_MATCH_FORTE_PADRAO): boolean {
  return compatibilidade >= limiar;
}

export function limiarMatchValido(valor: number): boolean {
  return Number.isFinite(valor) && valor > 0 && valor <= 1;
}

export function textoEmbeddingVaga(vaga: {
  titulo: string;
  descricao: string;
  senioridade: string;
  modelo: string;
  habilidades: readonly { nome: string; obrigatoria?: boolean }[];
}): string {
  return [
    vaga.titulo,
    `Senioridade: ${vaga.senioridade}`,
    `Modelo: ${vaga.modelo}`,
    vaga.habilidades.length ? `Habilidades: ${vaga.habilidades.map((item) => item.nome).join(', ')}` : '',
    vaga.descricao,
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Texto profissional do candidato. Não inclui nome, contato ou documentos:
 * o texto pode sair para um provedor externo de embeddings.
 */
export function textoEmbeddingCandidato(candidato: {
  perfil: Record<string, unknown>;
  habilidades: readonly { nome: string; nivel: number }[];
}): string {
  const perfil = candidato.perfil;
  const partes: string[] = [];
  if (typeof perfil.resumo === 'string' && perfil.resumo.trim()) partes.push(perfil.resumo.trim());
  const cargos = lista(perfil.experiencias, 'cargo');
  if (cargos.length) partes.push(`Experiência: ${cargos.join(', ')}`);
  const cursos = lista(perfil.formacao, 'curso');
  if (cursos.length) partes.push(`Formação: ${cursos.join(', ')}`);
  if (candidato.habilidades.length) {
    partes.push(`Habilidades: ${candidato.habilidades.map((item) => item.nome).join(', ')}`);
  }
  return partes.join('\n');
}

function lista(valor: unknown, campo: string): string[] {
  if (!Array.isArray(valor)) return [];
  return valor.flatMap((item) => {
    const texto = item && typeof item === 'object' ? (item as Record<string, unknown>)[campo] : null;
    return typeof texto === 'string' && texto.trim() ? [texto.trim()] : [];
  });
}

function limitar(valor: number): number {
  if (!Number.isFinite(valor)) return 0;
  return Math.min(1, Math.max(0, valor));
}

function arredondar(valor: number): number {
  return Math.round(valor * 10000) / 10000;
}
