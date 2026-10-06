import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException } from '@nestjs/common';

import { ErroAplicacao } from '../erros';

@Catch()
export class FiltroErros implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const resposta = host.switchToHttp().getResponse<{ status: (code: number) => { json: (body: unknown) => void } }>();
    if (exception instanceof ErroAplicacao) {
      resposta.status(exception.statusHttp).json({ codigo: exception.codigo, mensagem: exception.message });
      return;
    }
    if (exception instanceof HttpException) {
      resposta.status(exception.getStatus()).json({ codigo: 'HTTP', mensagem: exception.message });
      return;
    }
    resposta.status(500).json({ codigo: 'ERRO_INTERNO', mensagem: 'erro interno' });
  }
}
