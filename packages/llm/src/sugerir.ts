import { lerPrompt, VERSAO_PROMPT_SUGERIR } from './prompts';
import type { LlmProvider } from './tipos';

export interface EntradaSugestao {
  titulo: string;
  descricao: string;
  senioridade: string;
  modelo: string;
  habilidades: string[];
  existentes: string[];
  faltantes: number;
  tipoEtapa: string;
}

export interface PerguntaSugerida {
  enunciado: string;
  rubrica: { criterios: string[] };
  tempoLimiteSegundos: number;
}

export async function sugerirPerguntas(
  llm: LlmProvider,
  entrada: EntradaSugestao,
): Promise<{ versaoPrompt: string; perguntas: PerguntaSugerida[] }> {
  if (entrada.faltantes <= 0) return { versaoPrompt: VERSAO_PROMPT_SUGERIR, perguntas: [] };
  const sistema = lerPrompt(VERSAO_PROMPT_SUGERIR);
  const usuario = [
    `titulo: ${entrada.titulo}`,
    `descricao: ${entrada.descricao}`,
    `senioridade: ${entrada.senioridade}`,
    `modelo: ${entrada.modelo}`,
    `etapa: ${entrada.tipoEtapa}`,
    `habilidades: ${entrada.habilidades.join(', ') || 'não informadas'}`,
    `existentes: ${entrada.existentes.join(' | ') || 'nenhuma'}`,
    `faltantes: ${entrada.faltantes}`,
  ].join('\n');
  const resposta = await llm.complete({
    json: true,
    mensagens: [
      { role: 'system', content: sistema },
      { role: 'user', content: usuario },
    ],
  });
  return { versaoPrompt: VERSAO_PROMPT_SUGERIR, perguntas: interpretar(resposta.texto).slice(0, entrada.faltantes) };
}

function interpretar(texto: string): PerguntaSugerida[] {
  const inicio = texto.indexOf('{');
  const fim = texto.lastIndexOf('}');
  if (inicio < 0 || fim < inicio) return [];
  const json = JSON.parse(texto.slice(inicio, fim + 1)) as { perguntas?: unknown[] };
  if (!Array.isArray(json.perguntas)) return [];
  return json.perguntas.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const bruto = item as { enunciado?: unknown; rubrica?: { criterios?: unknown }; tempoLimiteSegundos?: unknown };
    if (typeof bruto.enunciado !== 'string' || bruto.enunciado.trim().length < 5) return [];
    const criterios = Array.isArray(bruto.rubrica?.criterios)
      ? bruto.rubrica.criterios.filter((criterio): criterio is string => typeof criterio === 'string')
      : ['clareza'];
    const tempo = typeof bruto.tempoLimiteSegundos === 'number' ? bruto.tempoLimiteSegundos : 180;
    return [{ enunciado: bruto.enunciado.trim(), rubrica: { criterios }, tempoLimiteSegundos: tempo }];
  });
}
