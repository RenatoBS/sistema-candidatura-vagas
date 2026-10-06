import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { consentimentosVigentes, VERSAO_TERMOS_ATUAL } from './consentimento';

describe('consentimentos', () => {
  it('fica com o registro mais recente de cada tipo', () => {
    const vigentes = consentimentosVigentes([
      { tipo: 'WHATSAPP' as const, concedido: true, versaoTermo: VERSAO_TERMOS_ATUAL, criadoEm: new Date('2026-01-01') },
      { tipo: 'WHATSAPP' as const, concedido: false, versaoTermo: VERSAO_TERMOS_ATUAL, criadoEm: new Date('2026-02-01') },
      { tipo: 'TERMOS' as const, concedido: true, versaoTermo: VERSAO_TERMOS_ATUAL, criadoEm: new Date('2026-01-02') },
    ]);
    assert.equal(vigentes.length, 2);
    assert.equal(vigentes.find((item) => item.tipo === 'WHATSAPP')?.concedido, false);
  });
});
