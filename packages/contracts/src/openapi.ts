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

/** Contrato das rotas de embeddings e match (F6-04). */
export const openApiFase6Match = {
  openapi: '3.0.3',
  info: {
    title: 'Sistema de Candidatura a Vagas',
    version: '0.6.0',
  },
  paths: {
    '/vagas/{vagaId}/sugestoes-match': { get: { operationId: 'listarSugestoesMatch' } },
    '/vagas/{vagaId}/sugestoes-match/{sugestaoId}/convidar': { post: { operationId: 'convidarParaVaga' } },
    '/candidatos/me/convites': { get: { operationId: 'listarConvites' } },
    '/candidatos/me/convites/{candidaturaId}/aceitar': { post: { operationId: 'aceitarConvite' } },
    '/candidatos/me/convites/{candidaturaId}/recusar': { post: { operationId: 'recusarConvite' } },
    '/candidatos/me/vagas-recomendadas': { get: { operationId: 'listarVagasRecomendadas' } },
    '/interno/match/embeddings/vagas/{vagaId}': { post: { operationId: 'jobEmbeddingVaga' } },
    '/interno/match/embeddings/candidatos/{candidatoId}': { post: { operationId: 'jobEmbeddingCandidato' } },
    '/interno/match/vagas/{vagaId}': { post: { operationId: 'jobMatchVaga' } },
    '/interno/match/candidatos/{candidatoId}': { post: { operationId: 'jobMatchCandidato' } },
  },
} as const;

/** Rotas da triagem WhatsApp (Fase 7). */
export const openApiFase7 = {
  openapi: '3.0.3',
  info: {
    title: 'Sistema de Candidatura a Vagas',
    version: '0.7.0',
  },
  paths: {
    '/interno/triagem/respostas/{respostaId}/transcrever': { post: { operationId: 'jobTranscreverResposta' } },
    '/interno/triagem/respostas/{respostaId}/falha': { post: { operationId: 'jobFalhaTranscricao' } },
    '/interno/triagem/respostas/{respostaId}/avaliar': { post: { operationId: 'jobAvaliarResposta' } },
    '/interno/triagem/entrevistas/{entrevistaId}/abandonar-inatividade': {
      post: { operationId: 'jobInatividadeTriagem' },
    },
    '/interno/triagem/entrevistas/{entrevistaId}/aceitar': { post: { operationId: 'jobAceiteTriagem' } },
    '/interno/triagem/entrevistas/{entrevistaId}/retry': { post: { operationId: 'jobRetryTriagem' } },
    '/interno/triagem/entrevistas/{entrevistaId}/esgotar': { post: { operationId: 'jobEsgotarTriagem' } },
    '/interno/triagem/eventos/{eventoId}/processar': { post: { operationId: 'jobProcessarWhatsapp' } },
    '/interno/triagem/candidaturas/{candidaturaId}/iniciar': { post: { operationId: 'jobIniciarTriagem' } },
    '/interno/triagem/monitorar': { post: { operationId: 'jobMonitorarWhatsapp' } },
    '/empresas/{empresaId}/vagas/{vagaId}/triagens': { get: { operationId: 'listarTriagens' } },
    '/empresas/{empresaId}/triagens/{entrevistaId}': { get: { operationId: 'detalheTriagem' } },
    '/empresas/{empresaId}/triagens/{entrevistaId}/respostas/{respostaId}/audio': {
      get: { operationId: 'audioTriagem' },
    },
    '/empresas/{empresaId}/triagens/{entrevistaId}/respostas/{respostaId}/revisao': {
      post: { operationId: 'revisarRespostaTriagem' },
    },
  },
} as const;

/** Rotas da entrevista por voz (Fase 8). */
export const openApiFase8 = {
  openapi: '3.0.3',
  info: {
    title: 'Sistema de Candidatura a Vagas',
    version: '0.8.0',
  },
  paths: {
    '/interno/voz/candidaturas/{candidaturaId}/preparar': { post: { operationId: 'jobPrepararVoz' } },
    '/interno/voz/entrevistas/{entrevistaId}/aceitar': { post: { operationId: 'jobAceitarVoz' } },
    '/interno/voz/sessoes/{sessaoId}/turno': { post: { operationId: 'jobTurnoVoz' } },
    '/interno/voz/sessoes/{sessaoId}/expirar': { post: { operationId: 'jobExpirarVoz' } },
    '/interno/voz/sessoes/{sessaoId}/desconectar': { post: { operationId: 'jobDesconectarVoz' } },
    '/interno/voz/sessoes/{sessaoId}/reconectar': { post: { operationId: 'jobReconectarVoz' } },
    '/interno/voz/sessoes/{sessaoId}/encerrar': { post: { operationId: 'jobEncerrarVoz' } },
    '/interno/voz/entrevistas/{entrevistaId}/visao': { get: { operationId: 'jobVisaoVoz' } },
    '/voz/candidaturas/{candidaturaId}/preparar': { post: { operationId: 'prepararVoz' } },
    '/voz/entrevistas/{entrevistaId}/aceitar': { post: { operationId: 'aceitarVoz' } },
    '/voz/sessoes/{sessaoId}/turno': { post: { operationId: 'turnoVoz' } },
    '/voz/sessoes/{sessaoId}/desconectar': { post: { operationId: 'desconectarVoz' } },
    '/voz/sessoes/{sessaoId}/reconectar': { post: { operationId: 'reconectarVoz' } },
    '/voz/sessoes/{sessaoId}/encerrar': { post: { operationId: 'encerrarVoz' } },
    '/voz/entrevistas/{entrevistaId}': { get: { operationId: 'visaoVoz' } },
    '/empresas/{empresaId}/vagas/{vagaId}/voz': { get: { operationId: 'listarVoz' } },
    '/empresas/{empresaId}/voz/{entrevistaId}': { get: { operationId: 'detalheVoz' } },
    '/empresas/{empresaId}/voz/{entrevistaId}/gravacao': { get: { operationId: 'gravacaoVoz' } },
    '/empresas/{empresaId}/voz/{entrevistaId}/excecao': { post: { operationId: 'excecaoVoz' } },
    '/empresas/{empresaId}/voz/{entrevistaId}/respostas/{respostaId}/revisao': {
      post: { operationId: 'revisarRespostaVoz' },
    },
  },
} as const;

/** Rotas de ranqueamento (Fase 9). */
export const openApiFase9 = {
  openapi: '3.0.3',
  info: {
    title: 'Sistema de Candidatura a Vagas',
    version: '0.9.0',
  },
  paths: {
    '/interno/ranking/vagas/{vagaId}/recalcular': { post: { operationId: 'jobRecalcularRanking' } },
    '/empresas/{empresaId}/vagas/{vagaId}/ranking': { get: { operationId: 'listarRanking' } },
    '/empresas/{empresaId}/vagas/{vagaId}/ranking/vies': { get: { operationId: 'viesRanking' } },
    '/empresas/{empresaId}/vagas/{vagaId}/ranking/pesos': { put: { operationId: 'definirPesosRanking' } },
    '/empresas/{empresaId}/ranking/respostas/{respostaId}/revisao': { post: { operationId: 'revisarNotaRanking' } },
  },
} as const;

export const openApi = {
  openapi: '3.0.3',
  info: {
    title: 'Sistema de Candidatura a Vagas',
    version: '0.9.0',
  },
  paths: {
    ...openApiFase3.paths,
    ...openApiFase4.paths,
    ...openApiFase5.paths,
    ...openApiFase6Match.paths,
    ...openApiFase7.paths,
    ...openApiFase8.paths,
    ...openApiFase9.paths,
  },
} as const;

export type CaminhoApi = keyof typeof openApi.paths;
