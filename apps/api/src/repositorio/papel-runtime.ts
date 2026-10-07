export interface PapelDeConexao {
  usuario: string;
  rolsuper: boolean;
  rolbypassrls: boolean;
}

export interface AvaliacaoPapel {
  nivel: 'ok' | 'aviso' | 'erro';
  mensagem: string;
}

/**
 * O RLS (ADR 0002) só protege se a API conectar como papel sem superuser e sem BYPASSRLS (`scv_app`).
 * Em produção, papel perigoso impede o boot; fora dela, avisa em voz alta (o dev local também precisa do RLS).
 */
export function avaliarPapelDeRuntime(papel: PapelDeConexao, ambiente: string | undefined): AvaliacaoPapel {
  if (!papel.rolsuper && !papel.rolbypassrls) {
    return { nivel: 'ok', mensagem: `conectado como ${papel.usuario} (RLS efetivo)` };
  }
  const motivos = [papel.rolsuper ? 'superuser' : null, papel.rolbypassrls ? 'BYPASSRLS' : null].filter(Boolean).join(' e ');
  const mensagem =
    `DATABASE_URL conecta como "${papel.usuario}", que é ${motivos}: o RLS não protege nada. ` +
    'Use o papel scv_app (docs/runbooks/ambiente-local.md); migrações usam MIGRATION_DATABASE_URL.';
  return { nivel: ambiente === 'production' ? 'erro' : 'aviso', mensagem };
}
