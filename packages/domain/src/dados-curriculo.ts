export interface ExperienciaCurriculo {
  cargo: string;
  organizacao: string;
  inicio: string | null;
  fim: string | null;
}

export interface FormacaoCurriculo {
  curso: string;
  instituicao: string;
}

export interface HabilidadeExtraida {
  nome: string;
  nivel: number;
}

export interface DadosCurriculo {
  resumo: string;
  experiencias: ExperienciaCurriculo[];
  formacao: FormacaoCurriculo[];
  idiomas: string[];
  habilidades: HabilidadeExtraida[];
}

/** JSON Schema da extração estruturada. A implementação LLM (Fase 4 / @scv/llm) deve obedecer este contrato. */
export const schemaDadosCurriculo = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  additionalProperties: false,
  required: ['resumo', 'experiencias', 'formacao', 'idiomas', 'habilidades'],
  properties: {
    resumo: { type: 'string' },
    experiencias: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['cargo', 'organizacao', 'inicio', 'fim'],
        properties: {
          cargo: { type: 'string' },
          organizacao: { type: 'string' },
          inicio: { type: ['string', 'null'] },
          fim: { type: ['string', 'null'] },
        },
      },
    },
    formacao: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['curso', 'instituicao'],
        properties: {
          curso: { type: 'string' },
          instituicao: { type: 'string' },
        },
      },
    },
    idiomas: { type: 'array', items: { type: 'string' } },
    habilidades: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['nome', 'nivel'],
        properties: {
          nome: { type: 'string' },
          nivel: { type: 'integer', minimum: 1, maximum: 5 },
        },
      },
    },
  },
} as const;

function texto(valor: unknown, max = 500): string | null {
  if (typeof valor !== 'string') return null;
  return valor.trim().slice(0, max);
}

export function dadosCurriculoValidos(valor: unknown): valor is DadosCurriculo {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return false;
  const dados = valor as Record<string, unknown>;
  if (typeof dados.resumo !== 'string') return false;
  if (!Array.isArray(dados.experiencias) || !Array.isArray(dados.formacao) || !Array.isArray(dados.idiomas)) {
    return false;
  }
  if (!Array.isArray(dados.habilidades)) return false;
  const experienciasOk = dados.experiencias.every((item) => {
    if (!item || typeof item !== 'object') return false;
    const exp = item as Record<string, unknown>;
    return typeof exp.cargo === 'string' && typeof exp.organizacao === 'string';
  });
  const formacaoOk = dados.formacao.every((item) => {
    if (!item || typeof item !== 'object') return false;
    const form = item as Record<string, unknown>;
    return typeof form.curso === 'string' && typeof form.instituicao === 'string';
  });
  const idiomasOk = dados.idiomas.every((item) => typeof item === 'string');
  const habilidadesOk = dados.habilidades.every((item) => {
    if (!item || typeof item !== 'object') return false;
    const hab = item as Record<string, unknown>;
    return typeof hab.nome === 'string' && typeof hab.nivel === 'number';
  });
  return experienciasOk && formacaoOk && idiomasOk && habilidadesOk;
}

export function dadosCurriculoVazios(): DadosCurriculo {
  return { resumo: '', experiencias: [], formacao: [], idiomas: [], habilidades: [] };
}

export function lerDadosCurriculo(valor: unknown): DadosCurriculo {
  if (!dadosCurriculoValidos(valor)) return dadosCurriculoVazios();
  return {
    resumo: texto(valor.resumo, 4000) ?? '',
    experiencias: valor.experiencias.map((item) => ({
      cargo: texto(item.cargo) ?? '',
      organizacao: texto(item.organizacao) ?? '',
      inicio: item.inicio === null ? null : texto(item.inicio, 40),
      fim: item.fim === null ? null : texto(item.fim, 40),
    })),
    formacao: valor.formacao.map((item) => ({
      curso: texto(item.curso) ?? '',
      instituicao: texto(item.instituicao) ?? '',
    })),
    idiomas: valor.idiomas.map((item) => texto(item, 40) ?? '').filter(Boolean),
    habilidades: valor.habilidades.map((item) => ({
      nome: texto(item.nome, 80) ?? '',
      nivel: Math.min(5, Math.max(1, Math.round(item.nivel || 3))),
    })),
  };
}

const CHAVES_PERFIL = ['resumo', 'experiencias', 'formacao', 'idiomas'] as const;

/** Copia os dados confirmados para o JSON de perfil. Não inclui score nem embedding. */
export function perfilAposConfirmacao(atual: Record<string, unknown>, dados: DadosCurriculo): Record<string, unknown> {
  const proximo: Record<string, unknown> = {};
  for (const [chave, valor] of Object.entries(atual)) {
    if (chave === 'score' || chave === 'embedding' || chave === 'posicao' || chave === 'percentil') continue;
    proximo[chave] = valor;
  }
  proximo.resumo = dados.resumo;
  proximo.experiencias = dados.experiencias;
  proximo.formacao = dados.formacao;
  proximo.idiomas = dados.idiomas;
  return proximo;
}

export function perfilSemDadosDeCurriculo(perfil: Record<string, unknown>): boolean {
  return CHAVES_PERFIL.every((chave) => perfil[chave] === undefined);
}
