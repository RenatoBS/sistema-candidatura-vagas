import { randomUUID } from 'node:crypto';

import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, Logger } from '@nestjs/common';

import { ErroAplicacao } from '../erros';

interface RespostaHttp {
  status: (code: number) => { json: (body: unknown) => void };
}

interface RequisicaoHttp {
  id?: unknown;
  method?: string;
  route?: { path?: string };
}

interface ErroPrisma {
  name?: string;
  code?: string;
  meta?: { target?: unknown; modelName?: unknown; cause?: unknown };
}

/** Erros conhecidos do Prisma que são do cliente, não do servidor. */
function erroDePrisma(exception: unknown): { status: number; codigo: string; mensagem: string } | null {
  const erro = exception as ErroPrisma | null;
  if (!erro || erro.name !== 'PrismaClientKnownRequestError' || typeof erro.code !== 'string') return null;
  if (erro.code === 'P2025') return { status: 404, codigo: 'NAO_ENCONTRADO', mensagem: 'registro não encontrado' };
  if (erro.code === 'P2002') return { status: 409, codigo: 'CONFLITO', mensagem: 'registro já existe' };
  if (erro.code === 'P2003') return { status: 409, codigo: 'REFERENCIA_INVALIDA', mensagem: 'registro relacionado inexistente' };
  if (erro.code === 'P2023') return { status: 400, codigo: 'PARAMETRO_INVALIDO', mensagem: 'identificador inválido' };
  return null;
}

/** Só os quadros da pilha: a primeira linha (mensagem) pode conter valores de consulta com dados pessoais. */
function pilhaSemMensagem(exception: unknown): string | undefined {
  if (!(exception instanceof Error) || !exception.stack) return undefined;
  return exception.stack
    .split('\n')
    .filter((linha) => linha.trimStart().startsWith('at '))
    .slice(0, 12)
    .join('\n');
}

@Catch()
export class FiltroErros implements ExceptionFilter {
  private readonly logger = new Logger('FiltroErros');

  catch(exception: unknown, host: ArgumentsHost): void {
    const contexto = host.switchToHttp();
    const resposta = contexto.getResponse<RespostaHttp>();
    if (exception instanceof ErroAplicacao) {
      resposta
        .status(exception.statusHttp)
        .json({ codigo: exception.codigo, mensagem: exception.message, ...(exception.detalhes === undefined ? {} : { detalhes: exception.detalhes }) });
      return;
    }
    if (exception instanceof HttpException) {
      resposta.status(exception.getStatus()).json({ codigo: 'HTTP', mensagem: exception.message });
      return;
    }
    const prisma = erroDePrisma(exception);
    if (prisma) {
      resposta.status(prisma.status).json({ codigo: prisma.codigo, mensagem: prisma.mensagem });
      return;
    }
    // 500: registra a exceção original (sem mensagem nem URL, que podem ter PII) com um id de correlação.
    const requisicao = contexto.getRequest<RequisicaoHttp>();
    const correlacaoId = typeof requisicao?.id === 'string' && requisicao.id ? requisicao.id : randomUUID();
    const erro = exception as ErroPrisma | null;
    this.logger.error(
      {
        msg: 'erro não tratado',
        correlacaoId,
        metodo: requisicao?.method,
        rota: requisicao?.route?.path,
        erro: erro?.name ?? typeof exception,
        codigoErro: typeof erro?.code === 'string' ? erro.code : undefined,
        alvo: erro?.meta?.target ?? erro?.meta?.modelName,
      },
      pilhaSemMensagem(exception),
    );
    resposta.status(500).json({ codigo: 'ERRO_INTERNO', mensagem: 'erro interno', correlacaoId });
  }
}
