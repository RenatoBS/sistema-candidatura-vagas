export type OrigemHabilidade = 'MANUAL' | 'CV_EXTRAIDO' | 'SUGESTAO_IA';

export interface ItemCatalogo {
  id: string;
  nome: string;
  categoria: string;
  sinonimos: string[];
}

export interface LinhaHabilidade {
  habilidadeId: string;
  nivel: number;
  anosExperiencia: number | null;
  origem: OrigemHabilidade;
}

export interface HabilidadeNomeada {
  nome: string;
  nivel: number;
}

export const CATALOGO_BASE: Omit<ItemCatalogo, 'id'>[] = [
  { nome: 'TypeScript', categoria: 'linguagem', sinonimos: ['TS'] },
  { nome: 'JavaScript', categoria: 'linguagem', sinonimos: ['JS'] },
  { nome: 'Node.js', categoria: 'plataforma', sinonimos: ['Node'] },
  { nome: 'React', categoria: 'framework', sinonimos: ['ReactJS'] },
  { nome: 'PostgreSQL', categoria: 'banco', sinonimos: ['Postgres'] },
  { nome: 'AWS', categoria: 'cloud', sinonimos: ['Amazon Web Services'] },
  { nome: 'Docker', categoria: 'ferramenta', sinonimos: [] },
  { nome: 'Comunicação', categoria: 'soft_skill', sinonimos: [] },
  { nome: 'Liderança', categoria: 'soft_skill', sinonimos: [] },
  { nome: 'NestJS', categoria: 'framework', sinonimos: [] },
];

export function normalizarNomeHabilidade(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

function contemTermo(texto: string, termo: string): boolean {
  if (termo.trim().length < 2) return false;
  const escapado = termo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^A-Za-z0-9])${escapado}([^A-Za-z0-9]|$)`, 'i').test(texto);
}

export function habilidadesCitadasNoTexto(texto: string, catalogo: ItemCatalogo[]): HabilidadeNomeada[] {
  const vistas = new Set<string>();
  const saida: HabilidadeNomeada[] = [];
  for (const item of catalogo) {
    const termos = [item.nome, ...item.sinonimos];
    if (!termos.some((termo) => contemTermo(texto, termo))) continue;
    const chave = normalizarNomeHabilidade(item.nome);
    if (vistas.has(chave)) continue;
    vistas.add(chave);
    saida.push({ nome: item.nome, nivel: 3 });
  }
  return saida;
}

export function normalizarHabilidades(
  extraidas: HabilidadeNomeada[],
  catalogo: ItemCatalogo[],
): { mapeadas: { habilidadeId: string; nome: string; nivel: number }[]; naoMapeadas: string[] } {
  const porNome = new Map<string, ItemCatalogo>();
  for (const item of catalogo) {
    porNome.set(normalizarNomeHabilidade(item.nome), item);
    for (const sinonimo of item.sinonimos) porNome.set(normalizarNomeHabilidade(sinonimo), item);
  }
  const mapeadas: { habilidadeId: string; nome: string; nivel: number }[] = [];
  const naoMapeadas: string[] = [];
  const ids = new Set<string>();
  for (const extraida of extraidas) {
    const item = porNome.get(normalizarNomeHabilidade(extraida.nome));
    if (!item) {
      naoMapeadas.push(extraida.nome);
      continue;
    }
    if (ids.has(item.id)) continue;
    ids.add(item.id);
    const nivel = Math.min(5, Math.max(1, Math.round(extraida.nivel || 3)));
    mapeadas.push({ habilidadeId: item.id, nome: item.nome, nivel });
  }
  return { mapeadas, naoMapeadas };
}

export function substituirManuais(atuais: LinhaHabilidade[], novas: LinhaHabilidade[]): LinhaHabilidade[] {
  const manuais = novas.map((linha) => ({ ...linha, origem: 'MANUAL' as const }));
  const ids = new Set(manuais.map((linha) => linha.habilidadeId));
  const resto = atuais.filter((linha) => linha.origem !== 'MANUAL' && !ids.has(linha.habilidadeId));
  return [...resto, ...manuais];
}

export function aplicarExtraidas(atuais: LinhaHabilidade[], extraidas: LinhaHabilidade[]): LinhaHabilidade[] {
  const idsManuais = new Set(atuais.filter((linha) => linha.origem === 'MANUAL').map((linha) => linha.habilidadeId));
  const manuais = atuais.filter((linha) => linha.origem === 'MANUAL');
  const sugestoes = atuais.filter((linha) => linha.origem === 'SUGESTAO_IA');
  const cvs = extraidas
    .filter((linha) => !idsManuais.has(linha.habilidadeId))
    .map((linha) => ({ ...linha, origem: 'CV_EXTRAIDO' as const }));
  const idsCv = new Set(cvs.map((linha) => linha.habilidadeId));
  return [...manuais, ...sugestoes.filter((linha) => !idsCv.has(linha.habilidadeId)), ...cvs];
}
