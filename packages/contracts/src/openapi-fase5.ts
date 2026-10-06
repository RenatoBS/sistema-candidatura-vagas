/** Rotas da Fase 5. O documento da Fase 3 permanece em `openapi.ts`. */
export const openApiFase5 = {
  openapi: '3.0.3',
  info: {
    title: 'Sistema de Candidatura a Vagas',
    version: '0.5.0',
  },
  paths: {
    '/candidatos/me': { get: { operationId: 'obterPerfil' }, put: { operationId: 'atualizarPerfil' } },
    '/candidatos/me/habilidades': {
      get: { operationId: 'listarHabilidades' },
      put: { operationId: 'substituirHabilidades' },
    },
    '/candidatos/me/consentimentos': {
      get: { operationId: 'listarConsentimentos' },
      post: { operationId: 'registrarConsentimento' },
    },
    '/curriculos/upload-url': { post: { operationId: 'criarUploadCurriculo' } },
    '/curriculos': { get: { operationId: 'listarCurriculos' }, post: { operationId: 'registrarCurriculo' } },
    '/curriculos/{id}': { get: { operationId: 'obterCurriculo' } },
    '/curriculos/{id}/confirmar': { post: { operationId: 'confirmarCurriculo' } },
    '/lgpd/exportar': { post: { operationId: 'exportarDados' } },
    '/lgpd/excluir': { post: { operationId: 'excluirDados' } },
  },
} as const;
