/**
 * API completa em Postgres real, conectando como `scv_app` (sem superuser/BYPASSRLS): o RLS vale de verdade.
 * Filas, e-mail, storage e demais provedores seguem falsos (AUTH_STORE=memory); só o repositório é Prisma.
 */
import { derrubarApp, subirApp } from '../../test/ajuda-http';
import { criarPrisma, prepararPapelApp, resetarBanco, urlDoPapelApp } from '../ajuda';

export * from '../../test/ajuda-http';

export async function subirAppPostgres(): Promise<void> {
  await resetarBanco();
  await prepararPapelApp();
  const admin = criarPrisma();
  try {
    await admin.habilidade.create({ data: { nome: 'TypeScript', categoria: 'linguagem', sinonimos: ['TS'] } });
  } finally {
    await admin.$disconnect();
  }
  process.env.SCV_REPOSITORIO = 'prisma';
  process.env.DATABASE_URL = urlDoPapelApp();
  await subirApp();
}

export { derrubarApp };
