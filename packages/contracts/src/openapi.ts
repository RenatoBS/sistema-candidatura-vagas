import { openApiFase5 } from './openapi-fase5';

/** Contrato das rotas da Fase 3. A especificação completa cresce nas fases seguintes. */
export const openApiFase3 = {
  openapi: '3.0.3',
  info: {
    title: 'Sistema de Candidatura a Vagas',
    version: '0.3.0',
  },
  paths: {
    '/auth/cadastro': { post: { operationId: 'cadastrar' } },
    '/auth/login': { post: { operationId: 'login' } },
    '/auth/refresh': { post: { operationId: 'refresh' } },
    '/auth/logout': { post: { operationId: 'logout' } },
    '/auth/recuperar': { post: { operationId: 'recuperarSenha' } },
    '/auth/redefinir': { post: { operationId: 'redefinirSenha' } },
    '/auth/confirmar-email': { post: { operationId: 'confirmarEmail' } },
    '/auth/mfa/iniciar': { post: { operationId: 'iniciarMfa' } },
    '/auth/mfa/confirmar': { post: { operationId: 'confirmarMfa' } },
    '/auth/mfa/verificar': { post: { operationId: 'verificarMfa' } },
    '/auth/reautenticar': { post: { operationId: 'reautenticar' } },
    '/me': { get: { operationId: 'me' } },
    '/me/visao': { patch: { operationId: 'alterarVisao' } },
    '/onboarding/candidato': { post: { operationId: 'onboardingCandidato' } },
    '/empresas/cadastro': { post: { operationId: 'cadastrarEmpresa' } },
    '/empresas/{empresaId}/verificacao/email': { post: { operationId: 'verificarEmailEmpresa' } },
    '/empresas/{empresaId}/verificacao/dominio': { post: { operationId: 'verificarDominio' } },
    '/empresas/{empresaId}/reenviar': { post: { operationId: 'reenviarVerificacao' } },
    '/empresas/{empresaId}/vagas/publicar': { post: { operationId: 'publicarVaga' } },
    '/empresas/{empresaId}/membros/convites': { post: { operationId: 'convidarMembro' } },
    '/empresas/{empresaId}/membros': { get: { operationId: 'listarMembros' } },
    '/convites/aceitar': { post: { operationId: 'aceitarConvite' } },
    '/empresas/{empresaId}/whatsapp/instancia': { post: { operationId: 'criarInstanciaWhatsapp' } },
    '/empresas/{empresaId}/whatsapp/conectar': { post: { operationId: 'conectarWhatsapp' } },
    '/empresas/{empresaId}/whatsapp/status': { get: { operationId: 'statusWhatsapp' } },
    '/empresas/{empresaId}/whatsapp/desconectar': { post: { operationId: 'desconectarWhatsapp' } },
    '/empresas/{empresaId}/auditoria': { get: { operationId: 'auditoriaEmpresa' } },
    '/admin/empresas': { get: { operationId: 'listarEmpresasAdmin' } },
    '/admin/empresas/fila': { get: { operationId: 'filaVerificacao' } },
    '/admin/empresas/{empresaId}/aprovar': { post: { operationId: 'aprovarEmpresa' } },
    '/admin/empresas/{empresaId}/rejeitar': { post: { operationId: 'rejeitarEmpresa' } },
    '/admin/empresas/{empresaId}/suspender': { post: { operationId: 'suspenderEmpresa' } },
    '/admin/empresas/{empresaId}/reativar': { post: { operationId: 'reativarEmpresa' } },
    '/admin/auditoria': { get: { operationId: 'auditoriaAdmin' } },
    '/admin/audios/{id}': { get: { operationId: 'lerAudioAdmin' } },
    '/admin/transcricoes/{id}': { get: { operationId: 'lerTranscricaoAdmin' } },
    '/admin/whatsapp/instancias': { get: { operationId: 'listarInstanciasAdmin' } },
    '/interno/empresas/{empresaId}/verificar-cnpj': { post: { operationId: 'jobVerificarCnpj' } },
    '/webhooks/whatsapp/uazapi/{instanciaId}': { post: { operationId: 'webhookWhatsapp' } },
  },
} as const;

/** Contrato das rotas da Fase 4 (vagas, processo, perguntas e ciclo de vida). */
export const openApiFase4 = {
  openapi: '3.0.3',
  info: {
    title: 'Sistema de Candidatura a Vagas',
    version: '0.4.0',
  },
  paths: {
    '/habilidades': { get: { operationId: 'listarHabilidades' } },
    '/empresas/{empresaId}/vagas': {
      get: { operationId: 'listarVagasEmpresa' },
      post: { operationId: 'criarVaga' },
    },
    '/empresas/{empresaId}/vagas/{vagaId}': {
      get: { operationId: 'obterVaga' },
      patch: { operationId: 'atualizarVaga' },
    },
    '/empresas/{empresaId}/vagas/{vagaId}/habilidades': {
      put: { operationId: 'definirHabilidadesVaga' },
    },
    '/empresas/{empresaId}/vagas/{vagaId}/processo': {
      put: { operationId: 'salvarProcesso' },
    },
    '/empresas/{empresaId}/vagas/{vagaId}/publicar': { post: { operationId: 'publicarVagaPorId' } },
    '/empresas/{empresaId}/vagas/{vagaId}/prorrogar': { post: { operationId: 'prorrogarVaga' } },
    '/empresas/{empresaId}/vagas/{vagaId}/pausar': { post: { operationId: 'pausarVaga' } },
    '/empresas/{empresaId}/vagas/{vagaId}/retomar': { post: { operationId: 'retomarVaga' } },
    '/empresas/{empresaId}/vagas/{vagaId}/fechar': { post: { operationId: 'fecharVaga' } },
    '/empresas/{empresaId}/vagas/{vagaId}/duplicar': { post: { operationId: 'duplicarVaga' } },
    '/empresas/{empresaId}/perguntas': {
      get: { operationId: 'listarPerguntas' },
      post: { operationId: 'criarPerguntaBanco' },
    },
    '/empresas/{empresaId}/vagas/{vagaId}/etapas/{etapaId}/perguntas': {
      post: { operationId: 'adicionarPerguntaEtapa' },
    },
    '/empresas/{empresaId}/vagas/{vagaId}/etapas/{etapaId}/perguntas/sugestoes': {
      post: { operationId: 'sugerirPerguntas' },
    },
    '/empresas/{empresaId}/perguntas/{perguntaId}/aceitar': { post: { operationId: 'aceitarSugestao' } },
    '/empresas/{empresaId}/perguntas/{perguntaId}/descartar': { post: { operationId: 'descartarSugestao' } },
    '/empresas/{empresaId}/perguntas/{perguntaId}': { patch: { operationId: 'revisarPergunta' } },
    '/vagas-publicas': { get: { operationId: 'listarVagasPublicas' } },
    '/vagas-publicas/{vagaId}': { get: { operationId: 'obterVagaPublica' } },
    '/vagas-publicas/{vagaId}/candidaturas': { post: { operationId: 'verificarInscricao' } },
    '/interno/vagas/reconciliar': { post: { operationId: 'reconciliarVagas' } },
    '/interno/vagas/{vagaId}/encerrar-inscricoes': { post: { operationId: 'encerrarInscricoes' } },
    '/interno/etapas/{etapaId}/sugerir': { post: { operationId: 'jobSugerirPerguntas' } },
    '/interno/eventos-vaga/{eventoId}/aplicar': { post: { operationId: 'aplicarEventoVaga' } },
  },
} as const;

export const openApi = {
  openapi: '3.0.3',
  info: {
    title: 'Sistema de Candidatura a Vagas',
    version: '0.5.0',
  },
  paths: { ...openApiFase3.paths, ...openApiFase4.paths, ...openApiFase5.paths },
} as const;

export type CaminhoApi = keyof typeof openApi.paths;
