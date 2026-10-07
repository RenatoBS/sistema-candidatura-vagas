import assert from 'node:assert/strict';
import test from 'node:test';
import { EmailLogProvider } from '@scv/providers';
import { CanalEmail } from '../src/notificacoes/canais';
import type { NotificacaoRegistro, Repositorio } from '../src/repositorio/tipos';

const notificacao = (tipo: 'CANDIDATO_NOVO' | 'MATCH_FORTE'): NotificacaoRegistro => ({
  id: 'notificacao-1', usuarioId: 'usuario-1', empresaId: 'empresa-1', tipo,
  chaveDedup: 'dedup', dados: { vagaTitulo: 'Desenvolvedor' }, agrupadas: tipo === 'CANDIDATO_NOVO' ? 3 : 1,
  lidaEm: null, criadoEm: new Date(),
});

test('F6-08 — canal de e-mail', async () => {
  const email = new EmailLogProvider(false);
  const repo = { buscarUsuarioPorId: async () => ({ email: 'recrutador@example.test' }) } as Pick<Repositorio, 'buscarUsuarioPorId'>;
  const canal = new CanalEmail(repo as Repositorio, email);
  await canal.entregar(notificacao('CANDIDATO_NOVO'));
  await canal.entregar(notificacao('MATCH_FORTE'));
  assert.match(email.enviados[0]!.texto, /3 candidatos novos/);
  assert.match(email.enviados[1]!.texto, /match forte/);
});
