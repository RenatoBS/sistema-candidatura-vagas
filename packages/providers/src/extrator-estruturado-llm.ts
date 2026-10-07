import {
  dadosCurriculoValidos,
  habilidadesCitadasNoTexto,
  lerDadosCurriculo,
  normalizarNomeHabilidade,
  schemaDadosCurriculo,
  type DadosCurriculo,
  type ItemCatalogo,
} from '@scv/domain';
import { envOu } from '@scv/env';
import { criarLlmProvider, lerPrompt, VERSAO_PROMPT_CURRICULO, type LlmProvider } from '@scv/llm';

import type { ExtratorEstruturadoCurriculo } from './extrator-estruturado';
import { ExtratorEstruturadoMock } from './extrator-estruturado';

/** Estrutura o currículo com o LlmProvider e o JSON Schema de `schemaDadosCurriculo`. */
export class ExtratorEstruturadoLlm implements ExtratorEstruturadoCurriculo {
  constructor(private readonly llm: LlmProvider) {}

  async extrair(texto: string, catalogo: ItemCatalogo[]): Promise<DadosCurriculo> {
    const resposta = await this.llm.complete({
      json: true,
      schema: schemaDadosCurriculo,
      mensagens: [
        { role: 'system', content: lerPrompt(VERSAO_PROMPT_CURRICULO) },
        {
          role: 'user',
          content: [`catalogo: ${catalogo.map((item) => item.nome).join(', ') || 'nenhum'}`, 'texto:', texto].join('\n'),
        },
      ],
    });
    const bruto = interpretarJson(resposta.texto);
    if (!dadosCurriculoValidos(bruto)) throw new Error('extração estruturada inválida');
    return completarCatalogo(lerDadosCurriculo(bruto), texto, catalogo);
  }
}

export function criarExtratorEstruturado(env: NodeJS.ProcessEnv = process.env): ExtratorEstruturadoCurriculo {
  if ((envOu(env, 'EXTRATOR_CURRICULO', 'mock')).toLowerCase() === 'llm') {
    return new ExtratorEstruturadoLlm(criarLlmProvider(env));
  }
  return new ExtratorEstruturadoMock();
}

function interpretarJson(texto: string): unknown {
  const inicio = texto.indexOf('{');
  const fim = texto.lastIndexOf('}');
  if (inicio < 0 || fim < inicio) return null;
  return JSON.parse(texto.slice(inicio, fim + 1)) as unknown;
}

function completarCatalogo(dados: DadosCurriculo, texto: string, catalogo: ItemCatalogo[]): DadosCurriculo {
  const vistas = new Set(dados.habilidades.map((item) => normalizarNomeHabilidade(item.nome)));
  for (const citada of habilidadesCitadasNoTexto(texto, catalogo)) {
    const chave = normalizarNomeHabilidade(citada.nome);
    if (vistas.has(chave)) continue;
    vistas.add(chave);
    dados.habilidades.push({ nome: citada.nome, nivel: 3 });
  }
  return dados;
}
