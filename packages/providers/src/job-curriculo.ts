import type { ItemCatalogo } from '@scv/domain';

import type { Armazenamento } from './armazenamento';
import type { DependenciasExtracao, ResultadoProcessamento } from './processar-curriculo';
import { processarArquivoCurriculo } from './processar-curriculo';

interface MetaCurriculo {
  arquivoKey: string;
  mimeType: string;
  statusProcessamento: string;
  catalogo: ItemCatalogo[];
}

export async function executarJobCurriculo(
  curriculoId: string,
  opcoes: {
    baseUrl: string;
    token: string;
    storage: Armazenamento;
    deps: DependenciasExtracao;
    fetchImpl?: typeof fetch;
  },
): Promise<void> {
  const fetchImpl = opcoes.fetchImpl ?? fetch;
  const cabecalhos = { 'x-internal-token': opcoes.token };
  const metaResposta = await fetchImpl(`${opcoes.baseUrl}/interno/curriculos/${curriculoId}`, { headers: cabecalhos });
  if (!metaResposta.ok) throw new Error(`meta do currículo falhou com status ${metaResposta.status}`);
  const meta = (await metaResposta.json()) as MetaCurriculo;
  if (meta.statusProcessamento === 'CONCLUIDO') return;
  try {
    const buffer = await opcoes.storage.ler(meta.arquivoKey);
    if (!buffer) throw new Error('arquivo ausente');
    const resultado = await processarArquivoCurriculo({ buffer, mimeType: meta.mimeType }, opcoes.deps, meta.catalogo);
    await enviarResultado(fetchImpl, opcoes, curriculoId, resultado);
  } catch (erro) {
    await fetchImpl(`${opcoes.baseUrl}/interno/curriculos/${curriculoId}/falha`, {
      method: 'POST',
      headers: { ...cabecalhos, 'content-type': 'application/json' },
      body: '{}',
    });
    throw erro;
  }
}

async function enviarResultado(
  fetchImpl: typeof fetch,
  opcoes: { baseUrl: string; token: string },
  curriculoId: string,
  resultado: ResultadoProcessamento,
): Promise<void> {
  const resposta = await fetchImpl(`${opcoes.baseUrl}/interno/curriculos/${curriculoId}/resultado`, {
    method: 'POST',
    headers: { 'x-internal-token': opcoes.token, 'content-type': 'application/json' },
    body: JSON.stringify(resultado),
  });
  if (!resposta.ok) throw new Error(`resultado do currículo falhou com status ${resposta.status}`);
}
