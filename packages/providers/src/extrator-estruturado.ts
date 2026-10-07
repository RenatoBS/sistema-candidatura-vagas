import {
  comporResumoCurriculo,
  dadosCurriculoVazios,
  extrairEstruturaCurriculo,
  habilidadesCitadasNoTexto,
  normalizarNomeHabilidade,
  resumoDeTextoLivre,
  type DadosCurriculo,
  type ItemCatalogo,
} from '@scv/domain';

/**
 * Extração estruturada do texto do currículo para o JSON Schema `schemaDadosCurriculo`.
 * O mock é o padrão em dev e teste. `ExtratorEstruturadoLlm` usa `@scv/llm` quando
 * `EXTRATOR_CURRICULO=llm`.
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
    const lido = extrairEstruturaCurriculo(texto);
    if (!dados.resumo) dados.resumo = lido.resumo;
    if (dados.experiencias.length === 0) dados.experiencias = lido.experiencias;
    if (dados.formacao.length === 0) dados.formacao = lido.formacao;
    if (dados.idiomas.length === 0) dados.idiomas = lido.idiomas;
    const vistas = new Set(dados.habilidades.map((item) => normalizarNomeHabilidade(item.nome)));
    for (const lida of lido.habilidades) {
      const chave = normalizarNomeHabilidade(lida.nome);
      if (vistas.has(chave)) continue;
      vistas.add(chave);
      dados.habilidades.push(lida);
    }
    for (const citada of habilidadesCitadasNoTexto(texto, catalogo)) {
      const chave = normalizarNomeHabilidade(citada.nome);
      if (vistas.has(chave)) continue;
      vistas.add(chave);
      dados.habilidades.push(citada);
    }
    if (!dados.resumo) dados.resumo = comporResumoCurriculo(dados) || resumoDeTextoLivre(texto);
    return dados;
  }
}
