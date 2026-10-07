import { DeviceNotRegisteredError, type EmailProvider, type PushProvider } from '@scv/providers';
import type { NotificacaoRegistro, Repositorio } from '../repositorio/tipos';
import type { CanalEntrega } from './canal-entrega';

function assunto(n: NotificacaoRegistro): string { return n.tipo === 'MATCH_FORTE' ? 'Novo match forte' : 'Novo candidato para sua vaga'; }
function texto(n: NotificacaoRegistro): string {
  const vaga = String(n.dados.vagaTitulo ?? 'sua vaga');
  return n.tipo === 'MATCH_FORTE' ? `Encontramos um match forte para ${vaga}.` : `${n.agrupadas > 1 ? `${n.agrupadas} candidatos novos` : 'Um candidato novo'} para ${vaga}.`;
}

export class CanalPush implements CanalEntrega {
  readonly canal = 'push' as const;
  constructor(private readonly repo: Repositorio, private readonly provider: PushProvider) {}
  async entregar(n: NotificacaoRegistro): Promise<void> {
    const invalidos: string[] = [];
    for (const dispositivo of await this.repo.listarDispositivosPush(n.usuarioId)) {
      try { await this.provider.enviar({ token: dispositivo.token, titulo: assunto(n), corpo: texto(n), dados: { notificacaoId: n.id, tipo: n.tipo } }); }
      catch (erro) { if (erro instanceof DeviceNotRegisteredError) invalidos.push(dispositivo.token); else throw erro; }
    }
    await this.repo.removerDispositivosPush(invalidos);
  }
}

export class CanalEmail implements CanalEntrega {
  readonly canal = 'email' as const;
  constructor(private readonly repo: Repositorio, private readonly provider: EmailProvider) {}
  async entregar(n: NotificacaoRegistro): Promise<void> {
    const usuario = await this.repo.buscarUsuarioPorId(n.usuarioId);
    if (usuario) await this.provider.enviar({ para: usuario.email, assunto: assunto(n), texto: texto(n) });
  }
}
