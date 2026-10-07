import { type FactoryProvider, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { criarLlmProvider } from '@scv/llm';
import {
  BrasilApiFonteCnpj,
  criarAntivirus,
  criarArmazenamentoS3,
  criarEmailProvider,
  criarEmbeddingProvider,
  criarPushProvider,
  UazapiInstanciaCliente,
  type EmbeddingProvider,
} from '@scv/providers';

import {
  antivirusTeste,
  armazenamentoTeste,
  dnsTeste,
  emailTeste,
  emailNotificacaoTeste,
  embeddingsTeste,
  filaCnpjTeste,
  filaCurriculoTeste,
  filaMatchTeste,
  filaVagasTeste,
  fonteCnpjTeste,
  pushTeste,
  relogioTeste,
  repositorioTeste,
  whatsappTeste,
  filaWhatsappEntradaTeste,
  deduplicadorWebhookTeste,
} from './ambiente-teste';
import { AcessoSensivelService } from './auditoria/acesso-sensivel';
import { AuditoriaService } from './auditoria/auditoria.service';
import { AuthService, relogioSistema, type Relogio } from './auth/auth.service';
import { MfaService } from './auth/mfa.service';
import {
  ConsentimentoService,
  CurriculoService,
  LgpdService,
  PerfilService,
} from './candidatos/candidato.service';
import { CandidaturaStateMachine } from './candidaturas/candidatura-state-machine';
import { CandidaturasService } from './candidaturas/candidaturas.service';
import type { ConfiguracaoApp } from './configuracao';
import { lerConfiguracao } from './configuracao';
import { DnsNode } from './dns';
import { EmpresasService } from './empresas/empresas.service';
import { FilaCnpjBull } from './fila/fila-cnpj';
import { FilaCurriculoBull } from './fila/fila-curriculo';
import { FilaMatchBull, type FilaMatch } from './fila/fila-match';
import { FilaVagasBull } from './fila/fila-vagas';
import {
  DeduplicadorWebhookMemoria,
  DeduplicadorWebhookRedis,
  FilaWhatsappEntradaBull,
} from './fila/fila-whatsapp-entrada';
import { AuditoriaController } from './http/auditoria.controller';
import { AuthController } from './http/auth.controller';
import { AuthGuard } from './http/auth.guard';
import { CandidatoController } from './http/candidatos.controller';
import { EmpresasController } from './http/empresas.controller';
import { MatchController } from './http/match.controller';
import { NotificacoesController } from './http/notificacoes.controller';
import { VagasController } from './http/vagas.controller';
import { WhatsappController } from './http/whatsapp.controller';
import { MatchService } from './match/match.service';
import { MembrosService } from './membros/membros.service';
import { CanalEmail, CanalPush } from './notificacoes/canais';
import type { CanalEntrega } from './notificacoes/canal-entrega';
import { NotificacoesService } from './notificacoes/notificacoes.service';
import { RepositorioPrisma } from './repositorio/prisma';
import type { Repositorio } from './repositorio/tipos';
import {
  ANTIVIRUS,
  ARMAZENAMENTO,
  CANAIS_ENTREGA,
  CLIENTE_WHATSAPP,
  CONFIG,
  DNS,
  EMAIL,
  EMBEDDINGS,
  FILA_CNPJ,
  FILA_CURRICULO,
  FILA_MATCH,
  FILA_VAGAS,
  FILA_WHATSAPP_ENTRADA,
  DEDUPLICADOR_WEBHOOK,
  FONTE_CNPJ,
  LLM,
  RELOGIO,
  REPOSITORIO,
} from './tokens';
import { VagasService } from './vagas/vagas.service';
import { WhatsappService } from './whatsapp/whatsapp.service';
import { WebhookUazapiService } from './whatsapp/webhook-uazapi.service';

const configProvider: FactoryProvider = {
  provide: CONFIG,
  useFactory: () => lerConfiguracao(),
};

const relogioProvider: FactoryProvider = {
  provide: RELOGIO,
  inject: [CONFIG],
  useFactory: (config: ConfiguracaoApp) =>
    config.authStore === 'memory' ? relogioTeste : relogioSistema,
};

const repositorioProvider: FactoryProvider<Repositorio> = {
  provide: REPOSITORIO,
  inject: [CONFIG],
  useFactory: (config: ConfiguracaoApp) =>
    config.authStore === 'memory' ? repositorioTeste : new RepositorioPrisma(),
};

const emailProvider: FactoryProvider = {
  provide: EMAIL,
  inject: [CONFIG],
  useFactory: (config: ConfiguracaoApp) =>
    config.authStore === 'memory' ? emailTeste : criarEmailProvider(),
};

const fonteProvider: FactoryProvider = {
  provide: FONTE_CNPJ,
  inject: [CONFIG],
  useFactory: (config: ConfiguracaoApp) =>
    config.authStore === 'memory' ? fonteCnpjTeste : new BrasilApiFonteCnpj(),
};

const filaProvider: FactoryProvider = {
  provide: FILA_CNPJ,
  inject: [CONFIG],
  useFactory: (config: ConfiguracaoApp) =>
    config.authStore === 'memory' ? filaCnpjTeste : new FilaCnpjBull(),
};

const dnsProvider: FactoryProvider = {
  provide: DNS,
  inject: [CONFIG],
  useFactory: (config: ConfiguracaoApp) =>
    config.authStore === 'memory' ? dnsTeste : new DnsNode(),
};

const armazenamentoProvider: FactoryProvider = {
  provide: ARMAZENAMENTO,
  inject: [CONFIG],
  useFactory: (config: ConfiguracaoApp) =>
    config.authStore === 'memory' ? armazenamentoTeste : criarArmazenamentoS3(),
};

const antivirusProvider: FactoryProvider = {
  provide: ANTIVIRUS,
  inject: [CONFIG],
  useFactory: (config: ConfiguracaoApp) =>
    config.authStore === 'memory' ? antivirusTeste : criarAntivirus(),
};

const filaCurriculoProvider: FactoryProvider = {
  provide: FILA_CURRICULO,
  inject: [CONFIG],
  useFactory: (config: ConfiguracaoApp) =>
    config.authStore === 'memory' ? filaCurriculoTeste : new FilaCurriculoBull(),
};

const filaVagasProvider: FactoryProvider = {
  provide: FILA_VAGAS,
  inject: [CONFIG],
  useFactory: (config: ConfiguracaoApp) =>
    config.authStore === 'memory' ? filaVagasTeste : new FilaVagasBull(),
};

const filaMatchProvider: FactoryProvider<FilaMatch> = {
  provide: FILA_MATCH,
  inject: [CONFIG],
  useFactory: (config: ConfiguracaoApp) =>
    config.authStore === 'memory' ? filaMatchTeste : new FilaMatchBull(),
};
const filaWhatsappEntradaProvider: FactoryProvider = {
  provide: FILA_WHATSAPP_ENTRADA,
  inject: [CONFIG],
  useFactory: (config: ConfiguracaoApp) =>
    config.authStore === 'memory' ? filaWhatsappEntradaTeste : new FilaWhatsappEntradaBull(),
};
const deduplicadorWebhookProvider: FactoryProvider = {
  provide: DEDUPLICADOR_WEBHOOK,
  inject: [CONFIG],
  useFactory: (config: ConfiguracaoApp) =>
    config.authStore === 'memory' ? deduplicadorWebhookTeste : new DeduplicadorWebhookRedis(),
};

const embeddingsProvider: FactoryProvider<EmbeddingProvider> = {
  provide: EMBEDDINGS,
  inject: [CONFIG],
  useFactory: (config: ConfiguracaoApp) =>
    config.authStore === 'memory' ? embeddingsTeste : criarEmbeddingProvider(),
};

/** Push (F6-07) e e-mail (F6-08) substituem os no-ops quando existirem. */
const canaisEntregaProvider: FactoryProvider<CanalEntrega[]> = {
  provide: CANAIS_ENTREGA,
  inject: [CONFIG, REPOSITORIO, EMAIL],
  useFactory: (config: ConfiguracaoApp, repo: Repositorio, email: typeof emailTeste) =>
    config.authStore === 'memory'
      ? [pushTeste, emailNotificacaoTeste]
      : [new CanalPush(repo, criarPushProvider()), new CanalEmail(repo, email)],
};

const llmProvider: FactoryProvider = {
  provide: LLM,
  useFactory: () => criarLlmProvider(),
};

const whatsappClienteProvider: FactoryProvider = {
  provide: CLIENTE_WHATSAPP,
  inject: [CONFIG],
  useFactory: (config: ConfiguracaoApp) =>
    config.authStore === 'memory'
      ? whatsappTeste
      : new UazapiInstanciaCliente(config.uazapiBaseUrl, config.uazapiAdminToken),
};

@Module({
  controllers: [
    AuthController,
    EmpresasController,
    WhatsappController,
    AuditoriaController,
    CandidatoController,
    VagasController,
    MatchController,
    NotificacoesController,
  ],
  providers: [
    configProvider,
    relogioProvider,
    repositorioProvider,
    emailProvider,
    fonteProvider,
    filaProvider,
    filaVagasProvider,
    filaMatchProvider,
    filaWhatsappEntradaProvider,
    deduplicadorWebhookProvider,
    WebhookUazapiService,
    embeddingsProvider,
    canaisEntregaProvider,
    llmProvider,
    dnsProvider,
    whatsappClienteProvider,
    armazenamentoProvider,
    antivirusProvider,
    filaCurriculoProvider,
    {
      provide: AuditoriaService,
      inject: [REPOSITORIO, RELOGIO],
      useFactory: (repo: Repositorio, relogio: typeof relogioSistema) =>
        new AuditoriaService(repo, relogio),
    },
    {
      provide: AuthService,
      inject: [REPOSITORIO, EMAIL, CONFIG, RELOGIO],
      useFactory: (
        repo: Repositorio,
        email: typeof emailTeste,
        config: ConfiguracaoApp,
        relogio: typeof relogioSistema,
      ) => new AuthService(repo, email, config, relogio),
    },
    {
      provide: MfaService,
      inject: [REPOSITORIO, AuthService, CONFIG, RELOGIO],
      useFactory: (
        repo: Repositorio,
        auth: AuthService,
        config: ConfiguracaoApp,
        relogio: typeof relogioSistema,
      ) => new MfaService(repo, auth, config, relogio),
    },
    {
      provide: EmpresasService,
      inject: [REPOSITORIO, EMAIL, FONTE_CNPJ, FILA_CNPJ, DNS, AuditoriaService, CONFIG, RELOGIO],
      useFactory: (
        repo: Repositorio,
        email: typeof emailTeste,
        fonte: typeof fonteCnpjTeste,
        fila: typeof filaCnpjTeste,
        dns: typeof dnsTeste,
        auditoria: AuditoriaService,
        config: ConfiguracaoApp,
        relogio: typeof relogioSistema,
      ) => new EmpresasService(repo, email, fonte, fila, dns, auditoria, config, relogio),
    },
    {
      provide: MembrosService,
      inject: [REPOSITORIO, EMAIL, RELOGIO],
      useFactory: (repo: Repositorio, email: typeof emailTeste, relogio: typeof relogioSistema) =>
        new MembrosService(repo, email, relogio),
    },
    {
      provide: WhatsappService,
      inject: [REPOSITORIO, CLIENTE_WHATSAPP, CONFIG, RELOGIO],
      useFactory: (
        repo: Repositorio,
        cliente: typeof whatsappTeste,
        config: ConfiguracaoApp,
        relogio: typeof relogioSistema,
      ) => new WhatsappService(repo, cliente, config, relogio),
    },
    {
      provide: PerfilService,
      inject: [REPOSITORIO, FILA_MATCH],
      useFactory: (repo: Repositorio, filaMatch: FilaMatch) => new PerfilService(repo, filaMatch),
    },
    {
      provide: CurriculoService,
      inject: [REPOSITORIO, ARMAZENAMENTO, ANTIVIRUS, FILA_CURRICULO, RELOGIO, FILA_MATCH],
      useFactory: (
        repo: Repositorio,
        armazenamento: typeof armazenamentoTeste,
        antivirus: typeof antivirusTeste,
        fila: typeof filaCurriculoTeste,
        relogio: typeof relogioSistema,
        filaMatch: FilaMatch,
      ) => new CurriculoService(repo, armazenamento, antivirus, fila, relogio, filaMatch),
    },
    {
      provide: ConsentimentoService,
      inject: [REPOSITORIO, RELOGIO],
      useFactory: (repo: Repositorio, relogio: typeof relogioSistema) =>
        new ConsentimentoService(repo, relogio),
    },
    {
      provide: LgpdService,
      inject: [REPOSITORIO, ARMAZENAMENTO, RELOGIO],
      useFactory: (
        repo: Repositorio,
        armazenamento: typeof armazenamentoTeste,
        relogio: typeof relogioSistema,
      ) => new LgpdService(repo, armazenamento, relogio),
    },
    {
      provide: AcessoSensivelService,
      inject: [REPOSITORIO, AuditoriaService],
      useFactory: (repo: Repositorio, auditoria: AuditoriaService) =>
        new AcessoSensivelService(repo, auditoria),
    },
    {
      provide: CandidaturaStateMachine,
      inject: [REPOSITORIO, RELOGIO],
      useFactory: (repo: Repositorio, relogio: Relogio) =>
        new CandidaturaStateMachine(repo, relogio),
    },
    {
      provide: NotificacoesService,
      inject: [REPOSITORIO, CANAIS_ENTREGA, CONFIG, RELOGIO],
      useFactory: (
        repo: Repositorio,
        canais: CanalEntrega[],
        config: ConfiguracaoApp,
        relogio: Relogio,
      ) => new NotificacoesService(repo, canais, config, relogio),
    },
    {
      provide: CandidaturasService,
      inject: [REPOSITORIO, CandidaturaStateMachine, RELOGIO, NotificacoesService],
      useFactory: (
        repo: Repositorio,
        maquina: CandidaturaStateMachine,
        relogio: Relogio,
        notificacoes: NotificacoesService,
      ) => new CandidaturasService(repo, maquina, relogio, notificacoes),
    },
    {
      provide: VagasService,
      inject: [
        REPOSITORIO,
        AuditoriaService,
        FILA_VAGAS,
        LLM,
        CONFIG,
        RELOGIO,
        CandidaturaStateMachine,
        FILA_MATCH,
      ],
      useFactory: (
        repo: Repositorio,
        auditoria: AuditoriaService,
        fila: typeof filaVagasTeste,
        llm: ReturnType<typeof criarLlmProvider>,
        config: ConfiguracaoApp,
        relogio: Relogio,
        candidaturas: CandidaturaStateMachine,
        filaMatch: FilaMatch,
      ) => new VagasService(repo, auditoria, fila, llm, config, relogio, candidaturas, filaMatch),
    },
    {
      provide: MatchService,
      inject: [REPOSITORIO, EMBEDDINGS, FILA_MATCH, CONFIG, RELOGIO],
      useFactory: (
        repo: Repositorio,
        embeddings: EmbeddingProvider,
        filaMatch: FilaMatch,
        config: ConfiguracaoApp,
        relogio: Relogio,
      ) => new MatchService(repo, embeddings, filaMatch, config, relogio),
    },
    AuthGuard,
    { provide: APP_GUARD, useExisting: AuthGuard },
  ],
})
export class PlataformaModule {}
