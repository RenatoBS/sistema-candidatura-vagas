import { randomUUID } from 'node:crypto';

import { papeisConviteValidos, type PapelEmpresa } from '@scv/domain';
import type { EmailProvider } from '@scv/providers';

import type { Relogio } from '../auth/auth.service';
import { segredoUrl, hashSegredo } from '../auth/segredos';
import { ErroAplicacao } from '../erros';
import type { Repositorio } from '../repositorio/tipos';
import { ctxDe, exigir, montarAtor, type SessaoRequest } from '../sessao';

export class MembrosService {
  constructor(
    private readonly repo: Repositorio,
    private readonly email: EmailProvider,
    private readonly relogio: Relogio,
  ) {}

  async convidar(sessao: SessaoRequest, empresaId: string, email: string, papeis: string[]) {
    const alinhada = await this.alinhar(sessao, empresaId);
    exigir(alinhada, 'gerenciar_membros');
    if (!papeisConviteValidos(papeis)) {
      throw new ErroAplicacao(
        'CONVITE_INVALIDO',
        400,
        'só é possível convidar recrutador ou avaliador; empresa não entra por convite',
      );
    }
    const token = segredoUrl();
    const ctx = ctxDe(alinhada, empresaId);
    const convite = await this.repo.criarConvite(
      {
        id: randomUUID(),
        empresaId,
        email: email.trim().toLowerCase(),
        papeis: papeis as PapelEmpresa[],
        tokenHash: hashSegredo(token),
        convidadoPorId: sessao.usuario.id,
        status: 'PENDENTE',
        expiraEm: new Date(this.relogio.agora().getTime() + 7 * 24 * 60 * 60 * 1000),
        aceitoEm: null,
      },
      ctx,
    );
    await this.email.enviar({
      para: convite.email,
      assunto: 'Convite para a empresa',
      texto: `token:${token}`,
    });
    return { id: convite.id, email: convite.email, papeis: convite.papeis, status: convite.status };
  }

  async listar(sessao: SessaoRequest, empresaId: string) {
    const alinhada = await this.alinhar(sessao, empresaId);
    exigir(alinhada, 'gerenciar_membros');
    const membros = await this.repo.listarMembros(empresaId, ctxDe(alinhada, empresaId));
    return membros.map((membro) => ({
      id: membro.id,
      usuarioId: membro.usuarioId,
      papeis: membro.papeis,
      status: membro.status,
    }));
  }

  async remover(sessao: SessaoRequest, empresaId: string, membroId: string) {
    const alinhada = await this.alinhar(sessao, empresaId);
    exigir(alinhada, 'gerenciar_membros');
    return this.repo.atualizarMembro(membroId, { status: 'REMOVIDO' }, ctxDe(alinhada, empresaId));
  }

  async aceitar(sessao: SessaoRequest, token: string) {
    const convite = await this.repo.buscarConvitePorHash(hashSegredo(token));
    const agora = this.relogio.agora();
    if (!convite || convite.status !== 'PENDENTE' || convite.expiraEm <= agora) {
      throw new ErroAplicacao('CONVITE_INVALIDO', 400, 'convite inválido');
    }
    if (convite.email !== sessao.usuario.email) {
      throw new ErroAplicacao('CONVITE_INVALIDO', 403, 'convite não pertence a esta conta');
    }
    const ctx = { empresaId: convite.empresaId };
    const existente = await this.repo.buscarMembro(sessao.usuario.id, convite.empresaId, ctx);
    if (existente && existente.status !== 'REMOVIDO') {
      throw new ErroAplicacao('JA_MEMBRO', 409, 'usuário já é membro');
    }
    const membro = existente
      ? await this.repo.atualizarMembro(existente.id, { status: 'ATIVO', papeis: convite.papeis }, ctx)
      : await this.repo.criarMembro(
          {
            id: randomUUID(),
            usuarioId: sessao.usuario.id,
            empresaId: convite.empresaId,
            papeis: convite.papeis,
            status: 'ATIVO',
          },
          ctx,
        );
    await this.repo.atualizarConvite(convite.id, { status: 'ACEITO', aceitoEm: agora }, ctx);
    return { empresaId: convite.empresaId, membroId: membro.id, papeis: membro.papeis };
  }

  private async alinhar(sessao: SessaoRequest, empresaId: string): Promise<SessaoRequest> {
    const ctx = ctxDe({ ...sessao, empresaId }, empresaId);
    const empresa = await this.repo.buscarEmpresaPorId(empresaId, ctx);
    const membro = await this.repo.buscarMembro(sessao.usuario.id, empresaId, ctx);
    const base = { ...sessao, empresaId, empresa, membro };
    return { ...base, ator: montarAtor(base) };
  }
}
