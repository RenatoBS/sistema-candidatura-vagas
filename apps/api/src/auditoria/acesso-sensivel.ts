import type { Armazenamento } from '@scv/providers';

import { ErroAplicacao } from '../erros';
import type { Repositorio } from '../repositorio/tipos';
import { ctxDe, exigir, papelAuditoria, type SessaoRequest } from '../sessao';
import { AuditoriaService } from './auditoria.service';

/** Vida da URL assinada do áudio: curta, para o acesso auditado não virar link compartilhável. */
export const EXPIRA_AUDIO_SEGUNDOS = 60;

export class AcessoSensivelService {
  constructor(
    private readonly repo: Repositorio,
    private readonly auditoria: AuditoriaService,
    private readonly armazenamento: Armazenamento,
  ) {}

  async ler(sessao: SessaoRequest, id: string, tipo: 'AUDIO' | 'TRANSCRICAO', motivo?: string) {
    if (!motivo?.trim()) {
      throw new ErroAplicacao('MOTIVO_OBRIGATORIO', 400, 'informe o motivo do acesso');
    }
    exigir(sessao, 'ver_audio_transcricao');
    const ctx = ctxDe(sessao);
    const resposta = await this.repo.buscarResposta(id, ctx);
    if (!resposta) throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'recurso não encontrado');
    if (sessao.visao !== 'ADMIN' && resposta.empresaId !== sessao.empresaId) {
      throw new ErroAplicacao('SEM_PERMISSAO', 403, 'sem permissão');
    }
    await this.auditoria.registrar(
      {
        usuarioId: sessao.usuario.id,
        empresaId: resposta.empresaId,
        papel: papelAuditoria(sessao),
        acao: tipo === 'AUDIO' ? 'LER_AUDIO' : 'LER_TRANSCRICAO',
        recursoTipo: tipo,
        recursoId: id,
        motivo: motivo.trim(),
      },
      { ...ctx, isAdmin: sessao.visao === 'ADMIN' || ctx.isAdmin, empresaId: resposta.empresaId },
    );
    if (tipo === 'AUDIO') {
      if (!resposta.audioUrl) throw new ErroAplicacao('NAO_ENCONTRADO', 404, 'áudio não encontrado');
      return {
        id: resposta.id,
        url: await this.armazenamento.criarUrlDownload(resposta.audioUrl, EXPIRA_AUDIO_SEGUNDOS),
        expiraEmSegundos: EXPIRA_AUDIO_SEGUNDOS,
      };
    }
    return { id: resposta.id, transcricao: resposta.transcricao };
  }
}
