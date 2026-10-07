import type {
  DadosCurriculo,
  ExperienciaCurriculo,
  FormacaoCurriculo,
  HabilidadeExtraida,
} from './dados-curriculo';

/**
 * Leitura heurística do texto de um currículo real (sem prefixos `resumo:`/`experiencia:`) e
 * composição do resumo quando o currículo não traz um. Funções puras: usadas pelo extrator mock
 * e como rede de segurança quando o LLM devolve resumo vazio.
 */

export type SecaoCurriculo = 'resumo' | 'experiencias' | 'formacao' | 'idiomas' | 'habilidades';

export interface SecoesCurriculo {
  /** Linhas antes da primeira seção (nome, contatos, cargo pretendido). */
  cabecalho: string[];
  secoes: Record<SecaoCurriculo, string[]>;
}

const TITULOS: Record<string, SecaoCurriculo> = {
  resumo: 'resumo',
  'resumo profissional': 'resumo',
  perfil: 'resumo',
  'perfil profissional': 'resumo',
  objetivo: 'resumo',
  'objetivo profissional': 'resumo',
  sobre: 'resumo',
  'sobre mim': 'resumo',
  summary: 'resumo',
  'professional summary': 'resumo',
  profile: 'resumo',
  about: 'resumo',
  experiencia: 'experiencias',
  experiencias: 'experiencias',
  'experiencia profissional': 'experiencias',
  'experiencias profissionais': 'experiencias',
  'historico profissional': 'experiencias',
  experience: 'experiencias',
  'work experience': 'experiencias',
  formacao: 'formacao',
  'formacao academica': 'formacao',
  educacao: 'formacao',
  escolaridade: 'formacao',
  education: 'formacao',
  idiomas: 'idiomas',
  idioma: 'idiomas',
  languages: 'idiomas',
  habilidades: 'habilidades',
  competencias: 'habilidades',
  'competencias tecnicas': 'habilidades',
  conhecimentos: 'habilidades',
  tecnologias: 'habilidades',
  skills: 'habilidades',
};

const MARCADOR = /^\s*[-•*·▪●○‣–]\s+/;
const MES = '(?:jan|fev|feb|mar|abr|apr|mai|may|jun|jul|ago|aug|set|sep|out|oct|nov|dez|dec)[a-z]*\\.?';
const DATA = `(?:(?:${MES}\\s*(?:de\\s*|\\/)?\\s*|\\d{1,2}\\/)\\d{4}|\\d{4})`;
const FIM = `(?:${DATA}|atual(?:mente)?|presente|hoje|present|current|now)`;
const INTERVALO = new RegExp(`\\(?\\b(${DATA})\\s*(?:-|–|—|a|até|ate|to)\\s*(${FIM})\\b\\)?`, 'i');
const FIM_ABERTO = /^(?:atual(?:mente)?|presente|hoje|present|current|now)$/i;
const CONTATO = /@|https?:\/\/|www\.|linkedin|github|\(?\d{2}\)?\s*9?\d{4}[-\s]?\d{4}/i;
const INSTITUICAO = /universidade|faculdade|instituto|centro universit|university|college|escola|senai|senac|etec|fatec/i;

function semAcento(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function linhasDoTexto(texto: string): string[] {
  return texto
    .split(/\r?\n/)
    .map((linha) => linha.trim())
    .filter(Boolean);
}

function tituloDeSecao(linha: string): { secao: SecaoCurriculo; resto: string } | null {
  const limpa = linha.replace(/^[#*_\s-]+/, '').replace(/[*_]+$/, '').trim();
  const dois = limpa.indexOf(':');
  const titulo = dois >= 0 ? limpa.slice(0, dois) : limpa;
  if (titulo.length > 40) return null;
  const secao = TITULOS[semAcento(titulo).replace(/[^a-z ]/g, '').trim()];
  if (!secao) return null;
  return { secao, resto: dois >= 0 ? limpa.slice(dois + 1).trim() : '' };
}

export function separarSecoesCurriculo(texto: string): SecoesCurriculo {
  const saida: SecoesCurriculo = {
    cabecalho: [],
    secoes: { resumo: [], experiencias: [], formacao: [], idiomas: [], habilidades: [] },
  };
  let atual: SecaoCurriculo | null = null;
  for (const linha of linhasDoTexto(texto)) {
    const titulo = tituloDeSecao(linha);
    if (titulo) {
      atual = titulo.secao;
      if (titulo.resto) saida.secoes[atual].push(titulo.resto);
      continue;
    }
    if (atual) saida.secoes[atual].push(linha);
    else saida.cabecalho.push(linha);
  }
  return saida;
}

function partirEmDois(texto: string): string[] {
  const separadores = [/\s*\|\s*/, /\s+[-–—@]\s+/, /\s+(?:na|no|em|at)\s+/i, /\s*,\s*/];
  for (const separador of separadores) {
    const partes = texto
      .split(separador)
      .map((parte) => parte.trim())
      .filter(Boolean);
    if (partes.length >= 2) return partes;
  }
  return texto ? [texto] : [];
}

function limparBordas(texto: string): string {
  return texto.replace(/^[\s|,;–—-]+|[\s|,;–—-]+$/g, '').trim();
}

function lerExperiencias(linhas: string[]): ExperienciaCurriculo[] {
  const itens: ExperienciaCurriculo[] = [];
  let pendentes: string[] = [];
  for (const linha of linhas) {
    if (MARCADOR.test(linha)) continue;
    const intervalo = INTERVALO.exec(linha);
    if (!intervalo) {
      pendentes = [...pendentes, linha].slice(-2);
      continue;
    }
    const partes = partirEmDois(limparBordas(linha.replace(intervalo[0], ' ')));
    const todas = partes.length >= 2 ? partes : [...pendentes.slice(-(2 - partes.length)), ...partes];
    pendentes = [];
    const [cargo, organizacao] = todas;
    if (!cargo || !organizacao) continue;
    const fim = intervalo[2] ?? '';
    itens.push({
      cargo: cargo.slice(0, 500),
      organizacao: organizacao.slice(0, 500),
      inicio: (intervalo[1] ?? '').trim() || null,
      fim: FIM_ABERTO.test(fim) ? null : fim.trim() || null,
    });
  }
  return itens;
}

function lerFormacao(linhas: string[]): FormacaoCurriculo[] {
  const itens: FormacaoCurriculo[] = [];
  let pendente: string | null = null;
  for (const linha of linhas) {
    if (MARCADOR.test(linha)) continue;
    const sem = limparBordas(linha.replace(INTERVALO, ' ').replace(/\(?\b(?:19|20)\d{2}\b\)?/g, ' '));
    if (!sem) continue;
    const partes = partirEmDois(sem);
    if (partes.length >= 2 && partes[0] && partes[1]) {
      itens.push({ curso: partes[0], instituicao: partes[1] });
      pendente = null;
    } else if (pendente) {
      itens.push({ curso: pendente, instituicao: sem });
      pendente = null;
    } else if (!INSTITUICAO.test(sem)) {
      pendente = sem;
    }
  }
  return itens;
}

function itensDeLista(linhas: string[], maximo: number, tamanho: number): string[] {
  const vistos = new Set<string>();
  const saida: string[] = [];
  for (const linha of linhas) {
    const semMarcador = linha.replace(MARCADOR, '');
    const aposDoisPontos = semMarcador.includes(':') ? semMarcador.slice(semMarcador.indexOf(':') + 1) : semMarcador;
    for (const bruto of aposDoisPontos.split(/[,;|•·]/)) {
      const item = limparBordas(bruto);
      const chave = semAcento(item);
      if (item.length < 2 || item.length > tamanho || vistos.has(chave)) continue;
      vistos.add(chave);
      saida.push(item);
      if (saida.length >= maximo) return saida;
    }
  }
  return saida;
}

function recortarEmFrase(texto: string, maximo: number): string {
  if (texto.length <= maximo) return texto;
  const corte = texto.slice(0, maximo);
  const fim = Math.max(corte.lastIndexOf('. '), corte.lastIndexOf('! '), corte.lastIndexOf('? '));
  return fim > maximo / 2 ? corte.slice(0, fim + 1) : `${corte.trimEnd()}…`;
}

function ehLinhaDeContato(linha: string): boolean {
  return CONTATO.test(linha);
}

/** Primeiro parágrafo corrido do texto, ignorando nome, contatos e títulos curtos. */
export function resumoDeTextoLivre(texto: string): string {
  const linhas = linhasDoTexto(texto).filter((linha) => !ehLinhaDeContato(linha) && !tituloDeSecao(linha));
  const corrido = linhas.filter((linha) => !MARCADOR.test(linha) && (linha.split(/\s+/).length >= 8 || linha.length >= 60));
  const escolhidas: string[] = [];
  for (const linha of corrido) {
    escolhidas.push(linha);
    if (escolhidas.join(' ').length >= 200) break;
  }
  return recortarEmFrase(escolhidas.join(' '), 600);
}

/** Estrutura o texto de um currículo usando os títulos de seção. Habilidades vêm só da seção própria. */
export function extrairEstruturaCurriculo(texto: string): DadosCurriculo {
  const { secoes } = separarSecoesCurriculo(texto);
  const habilidades: HabilidadeExtraida[] = itensDeLista(secoes.habilidades, 40, 40).map((nome) => ({ nome, nivel: 3 }));
  return {
    resumo: recortarEmFrase(secoes.resumo.join(' ').replace(/\s+/g, ' ').trim(), 600),
    experiencias: lerExperiencias(secoes.experiencias),
    formacao: lerFormacao(secoes.formacao),
    idiomas: itensDeLista(secoes.idiomas, 10, 40),
    habilidades,
  };
}

function anoDe(valor: string | null): number | null {
  const achado = valor ? /\d{4}/.exec(valor) : null;
  return achado ? Number(achado[0]) : null;
}

function experienciaMaisRecente(experiencias: ExperienciaCurriculo[]): ExperienciaCurriculo | undefined {
  let melhor: ExperienciaCurriculo | undefined;
  let melhorPeso = -1;
  for (const exp of experiencias) {
    const peso = exp.fim === null ? Number.POSITIVE_INFINITY : (anoDe(exp.fim) ?? anoDe(exp.inicio) ?? 0);
    if (peso > melhorPeso) {
      melhor = exp;
      melhorPeso = peso;
    }
  }
  return melhor;
}

/** Anos entre o início mais antigo e o fim mais recente (fim em aberto = ano de `agora`). */
export function anosDeExperiencia(experiencias: ExperienciaCurriculo[], agora: Date = new Date()): number | null {
  const inicios = experiencias.map((exp) => anoDe(exp.inicio)).filter((ano): ano is number => ano !== null);
  if (inicios.length === 0) return null;
  const fins = experiencias.map((exp) => (exp.fim === null ? agora.getFullYear() : anoDe(exp.fim)));
  const maior = Math.max(...fins.filter((ano): ano is number => ano !== null), Math.min(...inicios));
  const anos = maior - Math.min(...inicios);
  return anos > 0 && anos < 60 ? anos : null;
}

function lista(itens: string[]): string {
  if (itens.length <= 1) return itens.join('');
  return `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1] ?? ''}`;
}

/**
 * Monta um resumo curto a partir dos dados estruturados: posição mais recente, tempo de experiência,
 * formação, principais habilidades e idiomas. Devolve '' quando não há nada para resumir.
 */
export function comporResumoCurriculo(dados: Omit<DadosCurriculo, 'resumo'>, agora: Date = new Date()): string {
  const frases: string[] = [];
  const recente = experienciaMaisRecente(dados.experiencias);
  if (recente) {
    const anos = anosDeExperiencia(dados.experiencias, agora);
    const tempo = anos ? `, com cerca de ${anos} ${anos === 1 ? 'ano' : 'anos'} de experiência` : '';
    const outras = [
      ...new Set(dados.experiencias.filter((exp) => exp !== recente).map((exp) => exp.organizacao)),
    ].slice(0, 2);
    const passagens = outras.length > 0 ? ` Passagens anteriores: ${lista(outras)}.` : '';
    frases.push(`${recente.cargo} em ${recente.organizacao}${tempo}.${passagens}`);
  }
  const formacao = dados.formacao[0];
  if (formacao) frases.push(`Formação: ${formacao.curso} (${formacao.instituicao}).`);
  const principais = [...dados.habilidades].sort((a, b) => b.nivel - a.nivel).slice(0, 6);
  if (principais.length > 0) frases.push(`Habilidades: ${lista(principais.map((item) => item.nome))}.`);
  if (dados.idiomas.length > 0) frases.push(`Idiomas: ${lista(dados.idiomas.slice(0, 4))}.`);
  return recortarEmFrase(frases.join(' '), 600);
}
