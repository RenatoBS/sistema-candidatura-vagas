import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { criarEmailProvider, EmailLogProvider } from './email';

describe('e-mail', () => {
  it('sem SMTP usa o adapter que guarda a mensagem', async () => {
    const email = new EmailLogProvider(false);
    await email.enviar({ para: 'ana@acme.com', assunto: 'código', texto: 'codigo:123456' });
    assert.equal(email.ultimoPara('ana@acme.com')?.texto, 'codigo:123456');
  });

  it('escolhe SMTP quando SMTP_HOST existe e log quando não existe', () => {
    assert.equal(criarEmailProvider({}).constructor.name, 'EmailLogProvider');
    assert.equal(
      criarEmailProvider({ SMTP_HOST: 'localhost', SMTP_PORT: '1025' }).constructor.name,
      'EmailSmtpProvider',
    );
  });
});
