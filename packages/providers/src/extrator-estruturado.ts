import {
  dadosCurriculoVazios,
  habilidadesCitadasNoTexto,
  normalizarNomeHabilidade,
  type DadosCurriculo,
  type ItemCatalogo,
} from '@scv/domain';

/**
 * Extração estruturada do texto do currículo para o JSON Schema `schemaDadosCurriculo`.
 *
 * TODO(Fase 4): quando `@scv/llm` for mergeado, implementar esta interface com o
 * `LlmProvider` da Fase 4 (dona de `packages/llm`). Não criar `packages/llm` aqui.
 * A saída do modelo precisa passar por `dadosCurriculoValidos` antes de ser gravada.
 * O mock abaixo é determinístico e é o padrão enquanto a Fase 4 não entra.
 */
export interface ExtratorEstruturadoCurriculo {
  extrair(texto: string, catalogo: ItemCatalogo[]): Promise<DadosCurriculo>;
}

export class ExtratorEstruturadoMock implements ExtratorEstruturadoCurriculo {
  async extrair(texto: string, catalogo: ItemCatalogo[]): Promise<DadosCurriculo> {
    const dados = dadosCurriculoVazios();
    const linhas = texto
      .split(/\r?\n/)
      .map((linha) => linha.trim())
      .filter(Boolean);
    for (const linha of linhas) {
      const lower = linha.toLowerCase();
      if (lower.startsWith('resumo:')) dados.resumo = linha.slice(linha.indexOf(':') + 1).trim();
      else if (lower.startsWith('experiencia:')) {
        const [cargo, organizacao, inicio, fim] = linha
          .slice(linha.indexOf(':') + 1)
          .split('|')
          .map((parte) => parte.trim());
        if (cargo && organizacao) {
          dados.experiencias.push({ cargo, organizacao, inicio: inicio || null, fim: fim || null });
        }
      } else if (lower.startsWith('formacao:')) {
        const [curso, instituicao] = linha
          .slice(linha.indexOf(':') + 1)
          .split('|')
          .map((parte) => parte.trim());
        if (curso && instituicao) dados.formacao.push({ curso, instituicao });
      } else if (lower.startsWith('idioma:')) {
        const idioma = linha.slice(linha.indexOf(':') + 1).trim();
        if (idioma) dados.idiomas.push(idioma);
      } else if (lower.startsWith('habilidade:')) {
        const nome = linha.slice(linha.indexOf(':') + 1).trim();
        if (nome) dados.habilidades.push({ nome, nivel: 3 });
      }
    }
    if (!dados.resumo) {
      const solta = linhas.find((linha) => !linha.includes(':'));
      dados.resumo = (solta ?? linhas[0] ?? '').slice(0, 280);
    }
    const vistas = new Set(dados.habilidades.map((item) => normalizarNomeHabilidade(item.nome)));
    for (const citada of habilidadesCitadasNoTexto(texto, catalogo)) {
      const chave = normalizarNomeHabilidade(citada.nome);
      if (vistas.has(chave)) continue;
      vistas.add(chave);
      dados.habilidades.push(citada);
    }
    return dados;
  }
}
