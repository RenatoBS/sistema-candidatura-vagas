import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { decifrar, type ClienteInstanciaWhatsapp, type StatusInstanciaProvedor } from '@scv/providers';

import type { Relogio } from '../auth/auth.service';
import type { ConfiguracaoApp } from '../configuracao';
import type { InstanciaRegistro, Repositorio } from '../repositorio/tipos';
import { CLIENTE_WHATSAPP, CONFIG, RELOGIO, REPOSITORIO } from '../tokens';
import { urlWebhookUazapi } from '../whatsapp/webhook-url';
import { TriagemRetryService } from './triagem-retry.service';

const SISTEMA = { sistema: true as const };

@Injectable()
export class TriagemMonitorService {
  constructor(
    @Inject(REPOSITORIO) private readonly repo: Repositorio,
    @Inject(CLIENTE_WHATSAPP) private readonly cliente: ClienteInstanciaWhatsapp,
    @Inject(CONFIG) private readonly config: ConfiguracaoApp,
    @Inject(RELOGIO) private readonly relogio: Relogio,
    @Inject(TriagemRetryService) private readonly retries: TriagemRetryService,
  ) {}

  async varrer(): Promise<Array<{ id: string; status?: string; erro?: boolean }>> {
    const instancias = await this.repo.listarInstancias(SISTEMA);
    const saida: Array<{ id: string; status?: string; erro?: boolean }> = [];
    for (const instancia of instancias) {
      try {
        const token = decifrar(instancia.tokenCifrado, this.config.encryptionKey);
        const status = await this.cliente.status(token);
        const atualizada = await this.aplicar(instancia, status);
        saida.push({ id: instancia.id, status: atualizada.status });
      } catch {
        saida.push({ id: instancia.id, erro: true });
      }
    }
    return saida;
  }

  async aplicar(instancia: InstanciaRegistro, status: StatusInstanciaProvedor): Promise<InstanciaRegistro> {
    if (status.conectada && instancia.status !== 'CONECTADA') {
      const token = decifrar(instancia.tokenCifrado, this.config.encryptionKey);
      await this.cliente.configurarWebhook(
        token,
        urlWebhookUazapi(this.config.apiPublicUrl, instancia.id, this.config.uazapiWebhookSecret),
      );
      const agora = this.relogio.agora();
      const atualizada = await this.repo.salvarInstancia(
        {
          ...instancia,
          status: 'CONECTADA',
          numero: status.numero ?? instancia.numero,
          ultimaConexaoEm: agora,
          desconectadaEm: null,
        },
        { empresaId: instancia.empresaId, sistema: true },
      );
      await this.repo.encerrarQuedasAbertas(instancia.id, agora, SISTEMA);
      await this.retries.retomarEmpresa(instancia.empresaId, 'INSTANCIA');
      return atualizada;
    }
    if (!status.conectada && instancia.status === 'CONECTADA') {
      const agora = this.relogio.agora();
      const atualizada = await this.repo.salvarInstancia(
        { ...instancia, status: 'DESCONECTADA', desconectadaEm: agora },
        { empresaId: instancia.empresaId, sistema: true },
      );
      if (!(await this.repo.quedaAberta(instancia.id, SISTEMA))) {
        await this.repo.registrarQueda(
          {
            id: randomUUID(),
            empresaId: instancia.empresaId,
            instanciaWhatsappId: instancia.id,
            inicioEm: agora,
            fimEm: null,
            notificadaEm: agora,
          },
          SISTEMA,
        );
        await this.notificar(instancia, agora);
      }
      await this.retries.suspenderEmpresa(instancia.empresaId, 'INSTANCIA');
      return atualizada;
    }
    return instancia;
  }

  private async notificar(instancia: InstanciaRegistro, agora: Date): Promise<void> {
    const membros = await this.repo.listarMembros(instancia.empresaId, SISTEMA);
    const admins = await this.repo.listarUsuariosPorPapel('ADMIN_PLATAFORMA');
    const destinatarios = [
      ...membros
        .filter((membro) => membro.papeis.includes('ADMIN_EMPRESA') || membro.papeis.includes('RECRUTADOR'))
        .map((membro) => membro.usuarioId),
      ...admins.map((admin) => admin.id),
    ];
    for (const usuarioId of new Set(destinatarios)) {
      await this.repo.inserirNotificacaoUnica(
        {
          id: randomUUID(),
          usuarioId,
          empresaId: instancia.empresaId,
          tipo: 'WHATSAPP_DESCONECTADO',
          chaveDedup: `WHATSAPP_DESCONECTADO:${instancia.id}:${agora.toISOString()}:${usuarioId}`,
          dados: { instanciaId: instancia.id, empresaId: instancia.empresaId, central: true },
          criadoEm: agora,
        },
        { empresaId: instancia.empresaId, sistema: true },
      );
    }
  }
}
