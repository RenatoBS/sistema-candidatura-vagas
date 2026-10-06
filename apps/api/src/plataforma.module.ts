import { type FactoryProvider, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { BrasilApiFonteCnpj, criarAntivirus, criarArmazenamentoS3, criarEmailProvider, UazapiInstanciaCliente } from '@scv/providers';

import {
  antivirusTeste,
  armazenamentoTeste,
  dnsTeste,
  emailTeste,
  filaCnpjTeste,
  filaCurriculoTeste,
  fonteCnpjTeste,
  repositorioTeste,
  whatsappTeste,
} from './ambiente-teste';
import { AcessoSensivelService } from './auditoria/acesso-sensivel';
import { AuditoriaService } from './auditoria/auditoria.service';
import { AuthService, relogioSistema } from './auth/auth.service';
import { MfaService } from './auth/mfa.service';
import { ConsentimentoService, CurriculoService, LgpdService, PerfilService } from './candidatos/candidato.service';
import type { ConfiguracaoApp } from './configuracao';
import { lerConfiguracao } from './configuracao';
import { DnsNode } from './dns';
import { EmpresasService } from './empresas/empresas.service';
import { FilaCnpjBull } from './fila/fila-cnpj';
import { FilaCurriculoBull } from './fila/fila-curriculo';
import { AuditoriaController } from './http/auditoria.controller';
import { AuthController } from './http/auth.controller';
import { AuthGuard } from './http/auth.guard';
import { CandidatoController } from './http/candidatos.controller';
import { EmpresasController } from './http/empresas.controller';
import { WhatsappController } from './http/whatsapp.controller';
import { MembrosService } from './membros/membros.service';
import { RepositorioPrisma } from './repositorio/prisma';
import type { Repositorio } from './repositorio/tipos';
import {
  ANTIVIRUS,
  ARMAZENAMENTO,
  CLIENTE_WHATSAPP,
  CONFIG,
  DNS,
  EMAIL,
  FILA_CNPJ,
  FILA_CURRICULO,
  FONTE_CNPJ,
  RELOGIO,
  REPOSITORIO,
} from './tokens';
import { WhatsappService } from './whatsapp/whatsapp.service';

const configProvider: FactoryProvider = {
  provide: CONFIG,
  useFactory: () => lerConfiguracao(),
};

const relogioProvider: FactoryProvider = {
  provide: RELOGIO,
  useFactory: () => relogioSistema,
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
  useFactory: (config: ConfiguracaoApp) => (config.authStore === 'memory' ? emailTeste : criarEmailProvider()),
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
  useFactory: (config: ConfiguracaoApp) => (config.authStore === 'memory' ? filaCnpjTeste : new FilaCnpjBull()),
};

const dnsProvider: FactoryProvider = {
  provide: DNS,
  inject: [CONFIG],
  useFactory: (config: ConfiguracaoApp) => (config.authStore === 'memory' ? dnsTeste : new DnsNode()),
};

const armazenamentoProvider: FactoryProvider = {
  provide: ARMAZENAMENTO,
  inject: [CONFIG],
  useFactory: (config: ConfiguracaoApp) => (config.authStore === 'memory' ? armazenamentoTeste : criarArmazenamentoS3()),
};

const antivirusProvider: FactoryProvider = {
  provide: ANTIVIRUS,
  inject: [CONFIG],
  useFactory: (config: ConfiguracaoApp) => (config.authStore === 'memory' ? antivirusTeste : criarAntivirus()),
};

const filaCurriculoProvider: FactoryProvider = {
  provide: FILA_CURRICULO,
  inject: [CONFIG],
  useFactory: (config: ConfiguracaoApp) => (config.authStore === 'memory' ? filaCurriculoTeste : new FilaCurriculoBull()),
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
  controllers: [AuthController, EmpresasController, WhatsappController, AuditoriaController, CandidatoController],
  providers: [
    configProvider,
    relogioProvider,
    repositorioProvider,
    emailProvider,
    fonteProvider,
    filaProvider,
    dnsProvider,
    whatsappClienteProvider,
    armazenamentoProvider,
    antivirusProvider,
    filaCurriculoProvider,
    {
      provide: AuditoriaService,
      inject: [REPOSITORIO, RELOGIO],
      useFactory: (repo: Repositorio, relogio: typeof relogioSistema) => new AuditoriaService(repo, relogio),
    },
    {
      provide: AuthService,
      inject: [REPOSITORIO, EMAIL, CONFIG, RELOGIO],
      useFactory: (repo: Repositorio, email: typeof emailTeste, config: ConfiguracaoApp, relogio: typeof relogioSistema) =>
        new AuthService(repo, email, config, relogio),
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
      inject: [REPOSITORIO],
      useFactory: (repo: Repositorio) => new PerfilService(repo),
    },
    {
      provide: CurriculoService,
      inject: [REPOSITORIO, ARMAZENAMENTO, ANTIVIRUS, FILA_CURRICULO, RELOGIO],
      useFactory: (
        repo: Repositorio,
        armazenamento: typeof armazenamentoTeste,
        antivirus: typeof antivirusTeste,
        fila: typeof filaCurriculoTeste,
        relogio: typeof relogioSistema,
      ) => new CurriculoService(repo, armazenamento, antivirus, fila, relogio),
    },
    {
      provide: ConsentimentoService,
      inject: [REPOSITORIO, RELOGIO],
      useFactory: (repo: Repositorio, relogio: typeof relogioSistema) => new ConsentimentoService(repo, relogio),
    },
    {
      provide: LgpdService,
      inject: [REPOSITORIO, ARMAZENAMENTO, RELOGIO],
      useFactory: (repo: Repositorio, armazenamento: typeof armazenamentoTeste, relogio: typeof relogioSistema) =>
        new LgpdService(repo, armazenamento, relogio),
    },
    {
      provide: AcessoSensivelService,
      inject: [REPOSITORIO, AuditoriaService],
      useFactory: (repo: Repositorio, auditoria: AuditoriaService) => new AcessoSensivelService(repo, auditoria),
    },
    AuthGuard,
    { provide: APP_GUARD, useExisting: AuthGuard },
  ],
})
export class PlataformaModule {}
