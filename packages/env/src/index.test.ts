import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { carregarArquivoEnv, envNumero, envOpcional, envOu } from './index';

describe('@scv/env', () => {
  it('string vazia ou só com espaços conta como ausente', () => {
    assert.equal(envOu({ X: '' }, 'X', 'padrao'), 'padrao');
    assert.equal(envOu({ X: '   ' }, 'X', 'padrao'), 'padrao');
    assert.equal(envOu({}, 'X', 'padrao'), 'padrao');
    assert.equal(envOu({ X: 'valor' }, 'X', 'padrao'), 'valor');
    assert.equal(envOu({ X: ' valor ' }, 'X', 'padrao'), 'valor');
  });

  it('envOpcional devolve undefined para ausente e vazia', () => {
    assert.equal(envOpcional({ X: '' }, 'X'), undefined);
    assert.equal(envOpcional({}, 'X'), undefined);
    assert.equal(envOpcional({ X: 'a' }, 'X'), 'a');
  });

  it('carrega o .env mais próximo sem sobrescrever o processo', () => {
    const raiz = mkdtempSync(join(tmpdir(), 'scv-env-'));
    const filho = join(raiz, 'apps', 'api');
    mkdirSync(filho, { recursive: true });
    writeFileSync(join(raiz, '.env'), 'SCV_ENV_TESTE_CARGA=arquivo\nSCV_ENV_TESTE_JA=arquivo\n');
    delete process.env.SCV_ENV_TESTE_CARGA;
    process.env.SCV_ENV_TESTE_JA = 'processo';
    try {
      assert.equal(carregarArquivoEnv(filho), join(raiz, '.env'));
      assert.equal(process.env.SCV_ENV_TESTE_CARGA, 'arquivo');
      assert.equal(process.env.SCV_ENV_TESTE_JA, 'processo');
    } finally {
      delete process.env.SCV_ENV_TESTE_CARGA;
      delete process.env.SCV_ENV_TESTE_JA;
      rmSync(raiz, { recursive: true, force: true });
    }
  });

  it('envNumero aplica o padrão para vazio e recusa lixo', () => {
    assert.equal(envNumero({ P: '' }, 'P', 6379), 6379);
    assert.equal(envNumero({ P: '7000' }, 'P', 6379), 7000);
    assert.throws(() => envNumero({ P: 'abc' }, 'P', 1), /P deve ser um número/);
  });
});
