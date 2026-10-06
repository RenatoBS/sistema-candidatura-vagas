import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CATALOGO_BASE, type ItemCatalogo } from '@scv/domain';
import { ArmazenamentoMemoria, criarDepsOcrMock, executarJobCurriculo } from '@scv/providers';

import { FILA_CV } from './processar-cv';

const catalogo: ItemCatalogo[] = CATALOGO_BASE.map((item, indice) => ({
  ...item,
  id: `00000000-0000-4000-8000-${String(indice + 1).padStart(12, '0')}`,
}));

describe('job de currículo', () => {
  it('publica o resultado na API sem endpoint de perfil', async () => {
    assert.equal(FILA_CV, 'cv-processamento');
    const storage = new ArmazenamentoMemoria();
    const url = await storage.criarUrlUpload({
      key: 'curriculos/1/a',
      mimeType: 'application/pdf',
      tamanhoBytes: 4,
      baseApi: 'http://local/api/v1',
    });
    const token = url.url.split('/').pop() ?? '';
    assert.equal(storage.receber(token, Buffer.from('%PDF')).ok, true);
    const chamadas: string[] = [];
    const fetchImpl: typeof fetch = async (entrada, init) => {
      const endereco = String(entrada);
      chamadas.push(endereco);
      if (init?.method === 'POST') return new Response('{}', { status: 200 });
      return new Response(
        JSON.stringify({
          arquivoKey: 'curriculos/1/a',
          mimeType: 'application/pdf',
          statusProcessamento: 'PENDENTE',
          catalogo,
        }),
        { status: 200 },
      );
    };
    const deps = criarDepsOcrMock();
    deps.lerPdf = async () => [{ numero: 1, textoNativo: 'Experiencia com TypeScript e PostgreSQL no produto' }];
    await executarJobCurriculo('abc', {
      baseUrl: 'http://api/api/v1',
      token: 'segredo',
      storage,
      deps,
      fetchImpl,
    });
    assert.equal(chamadas.some((item) => item.includes('/perfil')), false);
    assert.equal(chamadas.some((item) => item.endsWith('/resultado')), true);
  });
});
