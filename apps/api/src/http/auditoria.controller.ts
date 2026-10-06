import { Controller, Get, Inject, Param, Query, Req } from '@nestjs/common';

import { AcessoSensivelService } from '../auditoria/acesso-sensivel';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { ctxDe, exigir, type SessaoRequest } from '../sessao';
import { Sensivel } from './decoradores';

interface RequisicaoComSessao {
  sessao: SessaoRequest;
}

@Controller()
export class AuditoriaController {
  constructor(
    @Inject(AuditoriaService) private readonly auditoria: AuditoriaService,
    @Inject(AcessoSensivelService) private readonly acesso: AcessoSensivelService,
  ) {}

  @Get('admin/auditoria')
  admin(@Req() req: RequisicaoComSessao) {
    exigir(req.sessao, 'consultar_auditoria');
    return this.auditoria.listar({ isAdmin: true });
  }

  @Get('empresas/:empresaId/auditoria')
  empresa(@Req() req: RequisicaoComSessao, @Param('empresaId') empresaId: string) {
    exigir({ ...req.sessao, empresaId }, 'consultar_auditoria');
    return this.auditoria.listar(ctxDe({ ...req.sessao, empresaId }, empresaId), empresaId);
  }

  @Get('admin/audios/:id')
  @Sensivel()
  audioAdmin(@Req() req: RequisicaoComSessao, @Param('id') id: string, @Query('motivo') motivo?: string) {
    return this.acesso.ler(req.sessao, id, 'AUDIO', motivo);
  }

  @Get('admin/transcricoes/:id')
  @Sensivel()
  transcricaoAdmin(@Req() req: RequisicaoComSessao, @Param('id') id: string, @Query('motivo') motivo?: string) {
    return this.acesso.ler(req.sessao, id, 'TRANSCRICAO', motivo);
  }

  @Get('empresas/:empresaId/audios/:id')
  @Sensivel()
  audioEmpresa(
    @Req() req: RequisicaoComSessao,
    @Param('id') id: string,
    @Query('motivo') motivo?: string,
  ) {
    return this.acesso.ler(req.sessao, id, 'AUDIO', motivo);
  }

  @Get('empresas/:empresaId/transcricoes/:id')
  @Sensivel()
  transcricaoEmpresa(
    @Req() req: RequisicaoComSessao,
    @Param('id') id: string,
    @Query('motivo') motivo?: string,
  ) {
    return this.acesso.ler(req.sessao, id, 'TRANSCRICAO', motivo);
  }
}
