import { randomUUID } from 'node:crypto';

import { cifrar, decifrar, type ClienteInstanciaWhatsapp } from '@scv/providers';

import type { ConfiguracaoApp } from '../configuracao';
import { ErroAplicacao } from '../erros';
import type { InstanciaRegistro, Repositorio } from '../repositorio/tipos';
import { ctxDe, exigir, montarAtor, type SessaoRequest } from '../sessao';
import type { TriagemMonitorService } from '../triagem/triagem-monitor.service';

export class WhatsappService {
  constructor(
    private readonly repo: Repositorio,
    private readonly cliente: ClienteInstanciaWhatsapp,
    private readonly config: ConfiguracaoApp,
    private readonly monitor: TriagemMonitorService,
  ) {}

  async criar(sessao: SessaoRequest, empresaId: string) {
    const alinhada = await this.alinhar(sessao, empresaId);
    exigir(alinhada, 'conectar_whatsapp');
    const ctx = ctxDe(alinhada, empresaId);
    const existente = await this.repo.buscarInstanciaPorEmpresa(empresaId, ctx);
    if (existente) return this.resumo(existente);
    this.exigirChave();
    const empresa = alinhada.empresa;
    if (!empresa) throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'empresa não encontrada');
    const criada = await this.cliente.init(empresa.nomeFantasia);
    const instancia: InstanciaRegistro = {
      id: randomUUID(),
      empresaId,
      instanciaIdProvedorCifrado: cifrar(criada.id, this.config.encryptionKey),
      tokenCifrado: cifrar(criada.token, this.config.encryptionKey),
      numero: null,
      status: 'AGUARDANDO_QR',
      ultimaConexaoEm: null,
      desconectadaEm: null,
    };
    await this.repo.salvarInstancia(instancia, ctx);
    return this.resumo(instancia);
  }

  async conectar(sessao: SessaoRequest, empresaId: string) {
    const alinhada = await this.alinhar(sessao, empresaId);
    exigir(alinhada, 'conectar_whatsapp');
    const instancia = await this.exigirInstancia(alinhada, empresaId);
    const conexao = await this.cliente.connect(this.tokenDe(instancia));
    return { ...this.resumo(instancia), qrcode: conexao.qrcode, pairingCode: conexao.pairingCode };
  }

  async status(sessao: SessaoRequest, empresaId: string) {
    const alinhada = await this.alinhar(sessao, empresaId);
    exigir(alinhada, 'ver_status_whatsapp');
    const ctx = ctxDe(alinhada, empresaId);
    const instancia = await this.repo.buscarInstanciaPorEmpresa(empresaId, ctx);
    if (!instancia) return { status: null, numero: null, ultimaConexaoEm: null, desconectadaEm: null };
    return this.sincronizar(instancia, ctx.isAdmin === true);
  }

  async desconectar(sessao: SessaoRequest, empresaId: string) {
    const alinhada = await this.alinhar(sessao, empresaId);
    exigir(alinhada, 'conectar_whatsapp');
    const instancia = await this.exigirInstancia(alinhada, empresaId);
    await this.cliente.disconnect(this.tokenDe(instancia));
    const atualizada = await this.monitor.aplicar(instancia, { conectada: false, numero: instancia.numero });
    return this.resumo(atualizada);
  }

  async listarAdmin(sessao: SessaoRequest) {
    exigir(sessao, 'ver_status_whatsapp');
    const instancias = await this.repo.listarInstancias({ isAdmin: true });
    const empresas = await this.repo.listarEmpresas({ isAdmin: true });
    return instancias.map((instancia) => ({
      ...this.resumo(instancia),
      nomeFantasia: empresas.find((empresa) => empresa.id === instancia.empresaId)?.nomeFantasia ?? null,
    }));
  }

  private async sincronizar(instancia: InstanciaRegistro, _isAdmin: boolean) {
    let statusProvedor: { conectada: boolean; numero: string | null };
    try {
      statusProvedor = await this.cliente.status(this.tokenDe(instancia));
    } catch {
      return this.resumo(instancia);
    }
    const atualizada = await this.monitor.aplicar(instancia, statusProvedor);
    return this.resumo(atualizada);
  }

  private async exigirInstancia(sessao: SessaoRequest, empresaId: string): Promise<InstanciaRegistro> {
    const instancia = await this.repo.buscarInstanciaPorEmpresa(empresaId, ctxDe(sessao, empresaId));
    if (!instancia) throw new ErroAplicacao('INSTANCIA_AUSENTE', 404, 'instância não criada');
    return instancia;
  }

  private tokenDe(instancia: InstanciaRegistro): string {
    this.exigirChave();
    return decifrar(instancia.tokenCifrado, this.config.encryptionKey);
  }

  private exigirChave(): void {
    if (!this.config.encryptionKey) {
      throw new ErroAplicacao('CRIPTOGRAFIA_AUSENTE', 500, 'APP_ENCRYPTION_KEY não configurada');
    }
  }

  private resumo(instancia: InstanciaRegistro) {
    return {
      id: instancia.id,
      empresaId: instancia.empresaId,
      status: instancia.status,
      numero: instancia.numero,
      ultimaConexaoEm: instancia.ultimaConexaoEm?.toISOString() ?? null,
      desconectadaEm: instancia.desconectadaEm?.toISOString() ?? null,
    };
  }

  private async alinhar(sessao: SessaoRequest, empresaId: string): Promise<SessaoRequest> {
    const ctx = ctxDe({ ...sessao, empresaId }, empresaId);
    const empresa = await this.repo.buscarEmpresaPorId(empresaId, ctx);
    const membro = await this.repo.buscarMembro(sessao.usuario.id, empresaId, ctx);
    const base = { ...sessao, empresaId, empresa, membro };
    return { ...base, ator: montarAtor(base) };
  }
}
