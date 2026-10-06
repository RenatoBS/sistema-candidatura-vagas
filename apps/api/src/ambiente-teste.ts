import { AntivirusMock, ArmazenamentoMemoria, EmailLogProvider, FakeUazapiInstancia, FonteCnpjControlavel } from '@scv/providers';

import { DnsControlavel } from './dns';
import { FilaCnpjMemoria } from './fila/fila-cnpj';
import { FilaCurriculoMemoria } from './fila/fila-curriculo';
import { RepositorioMemoria } from './repositorio/memoria';

export const repositorioTeste = new RepositorioMemoria();
export const emailTeste = new EmailLogProvider(false);
export const fonteCnpjTeste = new FonteCnpjControlavel();
export const filaCnpjTeste = new FilaCnpjMemoria();
export const filaCurriculoTeste = new FilaCurriculoMemoria();
export const dnsTeste = new DnsControlavel();
export const whatsappTeste = new FakeUazapiInstancia();
export const armazenamentoTeste = new ArmazenamentoMemoria();
export const antivirusTeste = new AntivirusMock();

export function limparAmbienteTeste(): void {
  repositorioTeste.limpar();
  emailTeste.limpar();
  fonteCnpjTeste.limpar();
  filaCnpjTeste.limpar();
  filaCurriculoTeste.limpar();
  dnsTeste.limpar();
  whatsappTeste.limpar();
  armazenamentoTeste.limpar();
}
